import { cache } from "react";
import { list, put, del, get, head } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";

/** JSON mirror TTL; Blob min cache is 60s. */
export const ARTICLE_CACHE_MAX_AGE = 60;
/** Immutable / media objects can stay cached longer. */
export const MEDIA_CACHE_MAX_AGE = 60 * 60 * 24 * 30;

function getStoreId(): string | undefined {
  return (
    process.env.BLOB_STORE_ID ||
    process.env.blog_STORE_ID ||
    process.env.BLOB_STOREID
  );
}

function getReadWriteToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.blog_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN_PUBLIC
  );
}

export function isBlobConfigured(): boolean {
  return Boolean(getReadWriteToken() || getStoreId());
}

/**
 * Public CDN host id (not `store_…`).
 * Prefer parsing the RW token (local, zero Blob ops); else normalize BLOB_STORE_ID.
 */
function resolvePublicHostId(): string | null {
  const explicit = process.env.BLOB_PUBLIC_HOST_ID?.trim();
  if (explicit) return explicit.replace(/^store_/, "");

  const token = getReadWriteToken();
  if (token) {
    // vercel_blob_rw_<hostId>_<secret>
    const parts = token.split("_");
    if (
      parts.length >= 4 &&
      parts[0] === "vercel" &&
      parts[1] === "blob" &&
      parts[2] === "rw" &&
      parts[3]
    ) {
      return parts[3];
    }
  }

  const storeId = getStoreId()?.trim();
  if (!storeId) return null;
  return storeId.startsWith("store_") ? storeId.slice("store_".length) : storeId;
}

/** Deterministic public URL for a pathname written with addRandomSuffix:false. */
export function publicBlobUrl(pathname: string): string | null {
  const base = process.env.BLOB_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/${pathname.replace(/^\//, "")}`;

  const hostId = resolvePublicHostId();
  if (!hostId) return null;
  return `https://${hostId}.public.blob.vercel-storage.com/${pathname.replace(/^\//, "")}`;
}

/** Per-request auth memo (React cache). */
export const blobAuth = cache(async (): Promise<{
  token?: string;
  storeId?: string;
  oidcToken?: string;
}> => {
  const token = getReadWriteToken();
  if (token) return { token };

  const storeId = getStoreId();
  if (!storeId) return {};

  try {
    const oidcToken = await getVercelOidcToken();
    return { storeId, oidcToken };
  } catch {
    return { storeId };
  }
});

export function assertBlobConfigured() {
  if (!isBlobConfigured()) {
    throw new Error(
      "Blob is not configured. Connect a public Vercel Blob store, or set BLOB_READ_WRITE_TOKEN.",
    );
  }
}

async function streamToJson<T>(
  stream: ReadableStream<Uint8Array>,
): Promise<T | null> {
  try {
    const text = await new Response(stream).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * A store over quota answers every download with `403 Your store is blocked`,
 * while list/head keep working. Remember that for a short while so reads stop
 * paying three round trips each, and recover on their own once it lifts.
 */
const BLOCKED_BACKOFF = 10 * 60 * 1000;
let downloadsBlockedAt = 0;

function downloadsBlocked() {
  return Date.now() - downloadsBlockedAt < BLOCKED_BACKOFF;
}

function noteBlocked(status: number | string) {
  if (String(status).includes("403")) downloadsBlockedAt = Date.now();
}

/** Low-volume diagnostics; only failure and self-heal paths log. */
function logBlob(event: string, detail: Record<string, unknown>) {
  console.warn(`[blob] ${event}`, JSON.stringify(detail));
}

function describeError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** "public" / "private" from a blob URL, without leaking the store id. */
export function blobHostKind(url: string): string {
  if (url.includes(".private.blob.vercel-storage.com")) return "private";
  if (url.includes(".public.blob.vercel-storage.com")) return "public";
  return "unknown";
}

/**
 * CDN GET of the canonical public pathname.
 * Counts as a Simple download — not an Advanced list/head/put.
 */
async function fetchPublicJson<T>(
  pathname: string,
): Promise<{ data: T | null; status: number | string }> {
  const url = publicBlobUrl(pathname);
  if (!url) return { data: null, status: "no-public-url" };
  try {
    const res = await fetch(url, {
      // Short Next data-cache so homepage spam doesn't re-hit CDN every time.
      next: { revalidate: ARTICLE_CACHE_MAX_AGE },
    });
    if (!res.ok) {
      // The body explains platform-level blocks (quota, suspension).
      const reason = await res.text().catch(() => "");
      return { data: null, status: `${res.status} ${reason.slice(0, 200)}` };
    }
    return { data: (await res.json()) as T, status: res.status };
  } catch (error) {
    return { data: null, status: describeError(error) };
  }
}

export function revisionPrefix(pathname: string) {
  return `${pathname}.rev/`;
}

type BlobAccess = "public" | "private";

/**
 * Stores can be public or private, and a private store rejects unauthenticated
 * CDN reads with 403. Remember whichever mode answers so we stop guessing.
 */
let preferredAccess: BlobAccess | null =
  process.env.BLOB_ACCESS === "private"
    ? "private"
    : process.env.BLOB_ACCESS === "public"
      ? "public"
      : null;

function accessOrder(): BlobAccess[] {
  return preferredAccess === "private"
    ? ["private", "public"]
    : ["public", "private"];
}

/**
 * Read JSON through the SDK, which attaches store credentials. Accepts a
 * pathname or a blob URL and tries both access modes. Counts as Simple ops.
 */
export async function readBlobJson<T>(
  target: string,
): Promise<{ data: T | null; attempts: string[] }> {
  const auth = await blobAuth();
  const attempts: string[] = [];

  for (const access of accessOrder()) {
    try {
      const result = await get(target, { access, ...auth });
      if (!result) {
        attempts.push(`${access}:404`);
        continue;
      }
      if (result.statusCode === 200 && result.stream) {
        const data = await streamToJson<T>(result.stream);
        if (data !== null) {
          preferredAccess = access;
          return { data, attempts };
        }
        attempts.push(`${access}:unparsable`);
        continue;
      }
      attempts.push(`${access}:${result.statusCode}`);
    } catch (error) {
      attempts.push(`${access}:${describeError(error)}`);
    }
  }

  return { data: null, attempts };
}

/** Per-instance guard so a missing mirror costs at most one list per path. */
const revisionLookupAt = new Map<string, number>();
const REVISION_LOOKUP_TTL = 5 * 60 * 1000;

function shouldLookUpRevisions(pathname: string) {
  const last = revisionLookupAt.get(pathname);
  if (last && Date.now() - last < REVISION_LOOKUP_TTL) return false;
  revisionLookupAt.set(pathname, Date.now());
  return true;
}

/**
 * Older writes treated `<path>.rev/<ts>-<id>.json` as the source of truth and
 * mirrored the canonical pathname without awaiting, so the mirror is often
 * missing. Recover the newest revision and rewrite the mirror so later reads
 * stay on the cheap CDN path.
 */
async function readFromRevisions<T>(pathname: string): Promise<T | null> {
  if (!shouldLookUpRevisions(pathname)) return null;

  try {
    const auth = await blobAuth();
    const { blobs } = await list({ prefix: revisionPrefix(pathname), ...auth });
    if (!blobs.length) {
      logBlob("revisions-empty", { pathname });
      return null;
    }

    const newest = [...blobs].sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    )[0];
    const { data, attempts } = await readBlobJson<T>(newest.pathname);
    if (data === null) {
      logBlob("revision-read-failed", {
        pathname,
        revision: newest.pathname,
        hostKind: blobHostKind(newest.url),
        attempts,
      });
      return null;
    }

    logBlob("revision-recovered", {
      pathname,
      revision: newest.pathname,
      mirroring: true,
    });
    // Best-effort mirror so the next read is a Simple CDN hit.
    void putJson(pathname, data).catch((error) =>
      logBlob("mirror-write-failed", {
        pathname,
        error: describeError(error),
      }),
    );
    return data;
  } catch (error) {
    logBlob("revision-list-failed", { pathname, error: describeError(error) });
    return null;
  }
}

/**
 * Read JSON for a logical pathname.
 *
 * Order: public CDN (Simple) → SDK `get()` (Simple) → newest revision via one
 * `list()` (Advanced, at most once per path per instance) which then rewrites
 * the canonical mirror.
 */
export async function readJsonByPath<T>(pathname: string): Promise<T | null> {
  assertBlobConfigured();
  if (downloadsBlocked()) return null;

  // Skip the anonymous CDN hop entirely once we know the store is private.
  if (preferredAccess !== "private") {
    const cdn = await fetchPublicJson<T>(pathname);
    if (cdn.data !== null) {
      preferredAccess = "public";
      return cdn.data;
    }
    logBlob("cdn-miss", { pathname, cdnStatus: cdn.status });
    noteBlocked(cdn.status);
  }

  const viaSdk = await readBlobJson<T>(pathname);
  if (viaSdk.data !== null) return viaSdk.data;

  logBlob("canonical-miss", {
    pathname,
    attempts: viaSdk.attempts,
    hasPublicUrl: Boolean(publicBlobUrl(pathname)),
  });
  noteBlocked(viaSdk.attempts.join(" "));
  if (downloadsBlocked()) return null;

  return readFromRevisions<T>(pathname);
}

/** @deprecated Prefer not listing; kept for rare admin rebuild paths. */
export async function pruneRevisions(pathname: string, keep: number) {
  try {
    const auth = await blobAuth();
    const { blobs } = await list({
      prefix: revisionPrefix(pathname),
      ...auth,
    });
    if (blobs.length <= keep) return;
    const stale = [...blobs]
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .slice(keep);
    await Promise.all(stale.map((b) => del(b.url, auth).catch(() => undefined)));
  } catch {
    // Quota / missing — ignore
  }
}

export async function deleteLogicalPath(pathname: string) {
  const auth = await blobAuth();
  // Only delete the canonical object — skip revision listing (Advanced).
  await del(pathname, auth).catch(() => undefined);
}

/**
 * Write JSON to the canonical pathname (one Advanced put).
 * No per-write revision list/prune — that was burning quota on every save.
 */
export async function putJson(pathname: string, data: unknown) {
  const auth = await blobAuth();
  const body = JSON.stringify(data, null, 2);
  const errors: string[] = [];

  for (const access of accessOrder()) {
    try {
      const result = await put(pathname, body, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: ARTICLE_CACHE_MAX_AGE,
        ...auth,
      });
      preferredAccess = access;
      return result;
    } catch (error) {
      errors.push(`${access}:${describeError(error)}`);
    }
  }

  throw new Error(`Blob write failed for ${pathname} (${errors.join(" | ")})`);
}

export async function pathExists(pathname: string): Promise<boolean> {
  try {
    const auth = await blobAuth();
    // head() asks the Blob API for metadata, so it works for either access mode.
    const meta = await head(pathname, auth);
    preferredAccess = blobHostKind(meta.url) === "private" ? "private" : "public";
    return true;
  } catch {
    return false;
  }
}

export async function latestRevisionBlob(pathname: string): Promise<{
  url: string;
  uploadedAt: Date;
  pathname: string;
} | null> {
  if (!isBlobConfigured()) return null;

  try {
    const auth = await blobAuth();
    const meta = await head(pathname, auth);
    return {
      url: meta.url,
      uploadedAt: meta.uploadedAt,
      pathname: meta.pathname,
    };
  } catch {
    return null;
  }
}
