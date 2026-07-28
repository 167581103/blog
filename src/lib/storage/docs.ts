import { eq, like, sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { documents } from "@/db/schema";
import {
  deleteLogicalPath,
  isBlobConfigured,
  pathExists,
  putJson,
  readJsonByPath,
} from "./blob";

/**
 * JSON document store.
 *
 * Postgres is the source of truth; Blob is only read as a legacy fallback and
 * anything found there is copied into Postgres. That keeps the site writable
 * when the Blob store is blocked by quota, and imports old content by itself
 * once Blob downloads work again.
 */

let schemaReady: Promise<void> | null = null;

/** Create the table on first use so no manual migration step is needed. */
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getDb().execute(sql`
        CREATE TABLE IF NOT EXISTS "documents" (
          "path" text PRIMARY KEY NOT NULL,
          "data" jsonb NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function describeError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

let loggedBackend = false;

/** Log the active backend once per instance so deploys are easy to verify. */
function noteBackend() {
  if (loggedBackend) return;
  loggedBackend = true;
  console.warn(
    "[docs] backend",
    JSON.stringify({
      postgres: isDbConfigured(),
      blobFallback: isBlobConfigured(),
    }),
  );
}

export function isDocStoreConfigured() {
  return isDbConfigured() || isBlobConfigured();
}

export function assertDocStoreConfigured() {
  if (!isDocStoreConfigured()) {
    throw new Error(
      "No storage configured. Set DATABASE_URL (Neon), or connect a Vercel Blob store.",
    );
  }
}

async function readFromDb<T>(pathname: string): Promise<T | null> {
  await ensureSchema();
  const [row] = await getDb()
    .select({ data: documents.data })
    .from(documents)
    .where(eq(documents.path, pathname))
    .limit(1);
  return row ? (row.data as T) : null;
}

async function writeToDb(pathname: string, data: unknown) {
  await ensureSchema();
  await getDb()
    .insert(documents)
    .values({ path: pathname, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: documents.path,
      set: { data, updatedAt: new Date() },
    });
}

export async function readDoc<T>(pathname: string): Promise<T | null> {
  noteBackend();
  if (isDbConfigured()) {
    try {
      const fromDb = await readFromDb<T>(pathname);
      if (fromDb !== null) return fromDb;
    } catch (error) {
      console.error(`[docs] read failed for ${pathname}:`, describeError(error));
    }
  }

  if (!isBlobConfigured()) return null;

  const legacy = await readJsonByPath<T>(pathname).catch(() => null);
  if (legacy === null) return null;

  if (isDbConfigured()) {
    // Import legacy Blob content so later reads never depend on Blob.
    await writeToDb(pathname, legacy).catch((error) =>
      console.error(`[docs] import failed for ${pathname}:`, describeError(error)),
    );
  }
  return legacy;
}

/** Returns a stable identifier for the stored document. */
export async function writeDoc(
  pathname: string,
  data: unknown,
): Promise<{ url: string }> {
  if (isDbConfigured()) {
    await writeToDb(pathname, data);
    return { url: `db:${pathname}` };
  }
  return putJson(pathname, data);
}

export async function deleteDoc(pathname: string): Promise<void> {
  if (isDbConfigured()) {
    try {
      await ensureSchema();
      await getDb().delete(documents).where(eq(documents.path, pathname));
    } catch (error) {
      console.error(`[docs] delete failed for ${pathname}:`, describeError(error));
    }
  }
  if (isBlobConfigured()) {
    await deleteLogicalPath(pathname).catch(() => undefined);
  }
}

export async function docExists(pathname: string): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      const row = await readFromDb<unknown>(pathname);
      if (row !== null) return true;
    } catch {
      // fall through to Blob
    }
  }
  if (!isBlobConfigured()) return false;
  return pathExists(pathname).catch(() => false);
}

/** Logical paths under a prefix, e.g. `trash/articles/`. Postgres only. */
export async function listDocPaths(prefix: string): Promise<string[]> {
  if (!isDbConfigured()) return [];
  try {
    await ensureSchema();
    const rows = await getDb()
      .select({ path: documents.path })
      .from(documents)
      .where(like(documents.path, `${prefix}%`));
    return rows.map((row) => row.path);
  } catch (error) {
    console.error(`[docs] list failed for ${prefix}:`, describeError(error));
    return [];
  }
}
