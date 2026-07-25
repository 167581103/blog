import { list, put, del } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { randomUUID } from "node:crypto";
import type { Article, ArticleInput, HomeContent } from "./types";
import { slugify } from "./slug";

const ARTICLES_PREFIX = "articles/";
const HOME_PATH = "site/home.json";

function articlePath(slug: string) {
  return `${ARTICLES_PREFIX}${slug}.json`;
}

/** Prefixed vars (blog_*) come from Blob connect Advanced Options / store name. */
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

function isBlobConfigured(): boolean {
  return Boolean(getReadWriteToken() || getStoreId());
}

/**
 * Prefer a static RW token (most reliable).
 * Otherwise use OIDC + store id (new Vercel Blob default).
 */
async function blobAuth(): Promise<{
  token?: string;
  storeId?: string;
  oidcToken?: string;
}> {
  const token = getReadWriteToken();
  if (token) {
    return { token };
  }

  const storeId = getStoreId();
  if (!storeId) {
    return {};
  }

  try {
    const oidcToken = await getVercelOidcToken();
    return { storeId, oidcToken };
  } catch {
    // Fall back to env-only OIDC if helper can't resolve a token.
    return { storeId };
  }
}

function assertBlobConfigured() {
  if (!isBlobConfigured()) {
    throw new Error(
      "Blob is not configured. Connect a public Vercel Blob store, or set BLOB_READ_WRITE_TOKEN.",
    );
  }
}

async function readJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function findBlobUrl(pathname: string): Promise<string | null> {
  assertBlobConfigured();
  const auth = await blobAuth();
  const { blobs } = await list({ prefix: pathname, ...auth });
  const exact = blobs.find((b) => b.pathname === pathname);
  return exact?.url ?? null;
}

export async function getHomeContent(): Promise<HomeContent> {
  const fallback: HomeContent = {
    title: "Blog",
    content:
      "A quiet place for notes, thoughts, and things worth keeping.\n\nSign in to write.",
    updatedAt: new Date(0).toISOString(),
  };

  if (!isBlobConfigured()) {
    return fallback;
  }

  try {
    const url = await findBlobUrl(HOME_PATH);
    if (!url) return fallback;
    const data = await readJson<HomeContent>(url);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export async function saveHomeContent(
  input: Pick<HomeContent, "title" | "content">,
): Promise<HomeContent> {
  assertBlobConfigured();
  const payload: HomeContent = {
    title: input.title.trim() || "Blog",
    content: input.content,
    updatedAt: new Date().toISOString(),
  };

  const auth = await blobAuth();
  await put(HOME_PATH, JSON.stringify(payload, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...auth,
  });

  return payload;
}

export async function listArticles(options?: {
  includeDrafts?: boolean;
}): Promise<Article[]> {
  if (!isBlobConfigured()) {
    return [];
  }

  try {
    assertBlobConfigured();
    const auth = await blobAuth();
    const { blobs } = await list({ prefix: ARTICLES_PREFIX, ...auth });
    const articles = (
      await Promise.all(
        blobs
          .filter((b) => b.pathname.endsWith(".json"))
          .map(async (b) => readJson<Article>(b.url)),
      )
    ).filter((a): a is Article => Boolean(a));

    const visible = options?.includeDrafts
      ? articles
      : articles.filter((a) => a.status === "published");

    return visible.sort((a, b) => {
      const aTime = a.publishedAt ?? a.updatedAt;
      const bTime = b.publishedAt ?? b.updatedAt;
      return bTime.localeCompare(aTime);
    });
  } catch {
    return [];
  }
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (!isBlobConfigured()) return null;

  try {
    const url = await findBlobUrl(articlePath(slug));
    if (!url) return null;
    return await readJson<Article>(url);
  } catch {
    return null;
  }
}

async function ensureUniqueSlug(base: string, exclude?: string): Promise<string> {
  let candidate = base;
  let i = 2;
  while (true) {
    if (candidate === exclude) return candidate;
    const existing = await getArticle(candidate);
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export async function createArticle(input: ArticleInput): Promise<Article> {
  assertBlobConfigured();
  const now = new Date().toISOString();
  const baseSlug = slugify(input.slug?.trim() || input.title);
  const slug = await ensureUniqueSlug(baseSlug);

  const article: Article = {
    id: randomUUID(),
    slug,
    title: input.title.trim() || "Untitled",
    content: input.content,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    publishedAt: input.status === "published" ? now : null,
  };

  const auth = await blobAuth();
  await put(articlePath(slug), JSON.stringify(article, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...auth,
  });

  return article;
}

export async function updateArticle(
  slug: string,
  input: ArticleInput,
): Promise<Article | null> {
  assertBlobConfigured();
  const existing = await getArticle(slug);
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextBase = slugify(input.slug?.trim() || input.title || existing.slug);
  const nextSlug = await ensureUniqueSlug(nextBase, existing.slug);

  const article: Article = {
    ...existing,
    slug: nextSlug,
    title: input.title.trim() || existing.title,
    content: input.content,
    status: input.status,
    updatedAt: now,
    publishedAt:
      input.status === "published"
        ? (existing.publishedAt ?? now)
        : existing.publishedAt,
  };

  const auth = await blobAuth();

  if (nextSlug !== existing.slug) {
    const oldUrl = await findBlobUrl(articlePath(existing.slug));
    if (oldUrl) await del(oldUrl, auth);
  }

  await put(articlePath(nextSlug), JSON.stringify(article, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...auth,
  });

  return article;
}

export async function deleteArticle(slug: string): Promise<boolean> {
  assertBlobConfigured();
  const url = await findBlobUrl(articlePath(slug));
  if (!url) return false;
  const auth = await blobAuth();
  await del(url, auth);
  return true;
}

export async function uploadMedia(
  file: File | Blob,
  filename: string,
): Promise<string> {
  assertBlobConfigured();
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  const pathname = `uploads/${randomUUID()}${ext}`;
  const auth = await blobAuth();
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    ...auth,
  });
  return blob.url;
}
