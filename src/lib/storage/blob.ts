import { cache } from "react";
import { list, put, del, get, head } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { randomUUID } from "node:crypto";

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

export function revisionPrefix(pathname: string) {
  return `${pathname}.rev/`;
}

async function fetchJsonUrl<T>(
  url: string,
  bust: string | number,
): Promise<T | null> {
  const target = new URL(url);
  target.searchParams.set("v", String(bust));
  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Read JSON for a logical pathname.
 *
 * Public Blob `get(..., useCache:false)` is a no-op in the SDK (bypass is
 * private-only). Prefer immutable revisions under `{pathname}.rev/…`.
 */
export async function readJsonByPath<T>(pathname: string): Promise<T | null> {
  assertBlobConfigured();
  const auth = await blobAuth();

  const { blobs } = await list({
    prefix: revisionPrefix(pathname),
    ...auth,
  });
  if (blobs.length) {
    const newest = [...blobs].sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    )[0];
    return fetchJsonUrl<T>(newest.url, newest.uploadedAt.getTime());
  }

  try {
    const meta = await head(pathname, auth);
    return fetchJsonUrl<T>(meta.url, meta.uploadedAt.getTime());
  } catch {
    const result = await get(pathname, {
      access: "public",
      ...auth,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return streamToJson<T>(result.stream);
  }
}

export async function pruneRevisions(pathname: string, keep: number) {
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
}

export async function deleteLogicalPath(pathname: string) {
  const auth = await blobAuth();
  const { blobs } = await list({
    prefix: revisionPrefix(pathname),
    ...auth,
  });
  await Promise.all([
    ...blobs.map((b) => del(b.url, auth).catch(() => undefined)),
    del(pathname, auth).catch(() => undefined),
  ]);
}

/** Write JSON as a new immutable revision + best-effort legacy mirror. */
export async function putJson(pathname: string, data: unknown) {
  const auth = await blobAuth();
  const body = JSON.stringify(data, null, 2);
  const versionPath = `${revisionPrefix(pathname)}${Date.now()}-${randomUUID().slice(0, 8)}.json`;

  const version = await put(versionPath, body, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: MEDIA_CACHE_MAX_AGE,
    ...auth,
  });

  void Promise.all([
    put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: ARTICLE_CACHE_MAX_AGE,
      ...auth,
    }).catch(() => undefined),
    pruneRevisions(pathname, 5),
  ]);

  return version;
}

export async function pathExists(pathname: string): Promise<boolean> {
  const auth = await blobAuth();
  const { blobs } = await list({
    prefix: revisionPrefix(pathname),
    ...auth,
  });
  if (blobs.length) return true;
  try {
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
  const auth = await blobAuth();
  const { blobs } = await list({
    prefix: revisionPrefix(pathname),
    ...auth,
  });
  if (blobs.length) {
    const newest = [...blobs].sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    )[0];
    return {
      url: newest.url,
      uploadedAt: newest.uploadedAt,
      pathname: newest.pathname,
    };
  }
  try {
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
