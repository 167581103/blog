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
 * CDN GET of the canonical public pathname.
 * Counts as a Simple download — not an Advanced list/head/put.
 */
async function fetchPublicJson<T>(pathname: string): Promise<T | null> {
  const url = publicBlobUrl(pathname);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      // Short Next data-cache so homepage spam doesn't re-hit CDN every time.
      next: { revalidate: ARTICLE_CACHE_MAX_AGE },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function revisionPrefix(pathname: string) {
  return `${pathname}.rev/`;
}

/**
 * Read JSON for a logical pathname.
 *
 * Hot path: public CDN fetch only (Simple ops). Avoids `list()` / `head()`
 * Advanced operations that burned the free-tier quota.
 */
export async function readJsonByPath<T>(pathname: string): Promise<T | null> {
  assertBlobConfigured();

  const fromCdn = await fetchPublicJson<T>(pathname);
  if (fromCdn !== null) return fromCdn;

  // Fallback: SDK get by pathname (still no list). May fail if Advanced is frozen.
  try {
    const auth = await blobAuth();
    const result = await get(pathname, {
      access: "public",
      ...auth,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return streamToJson<T>(result.stream);
  } catch {
    return null;
  }
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
 * Write JSON to the canonical public pathname (one Advanced put).
 * No per-write revision list/prune — that was burning quota on every save.
 */
export async function putJson(pathname: string, data: unknown) {
  const auth = await blobAuth();
  const body = JSON.stringify(data, null, 2);

  return put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: ARTICLE_CACHE_MAX_AGE,
    ...auth,
  });
}

export async function pathExists(pathname: string): Promise<boolean> {
  const url = publicBlobUrl(pathname);
  if (url) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        next: { revalidate: ARTICLE_CACHE_MAX_AGE },
      });
      if (res.ok) return true;
    } catch {
      // fall through
    }
  }

  try {
    const auth = await blobAuth();
    await head(pathname, auth);
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

  const url = publicBlobUrl(pathname);
  if (url) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        next: { revalidate: ARTICLE_CACHE_MAX_AGE },
      });
      if (res.ok) {
        return {
          url,
          uploadedAt: new Date(),
          pathname,
        };
      }
    } catch {
      // fall through
    }
  }

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
