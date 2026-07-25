import { list, put, del } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { randomUUID } from "node:crypto";
import type { Article, ArticleInput, HomeContent } from "./types";
import { slugify } from "./slug";

const ARTICLES_PREFIX = "articles/";
const HOME_PATH = "site/home.json";
const INDEX_PATH = "articles/index.json";

/** Article JSON must revalidate quickly; Blob min cache is 60s. */
const ARTICLE_CACHE_MAX_AGE = 60;
/** Uploaded media can stay cached longer. */
const MEDIA_CACHE_MAX_AGE = 60 * 60 * 24 * 30;

function articlePath(slug: string) {
  return `${ARTICLES_PREFIX}${slug}.json`;
}

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

async function blobAuth(): Promise<{
  token?: string;
  storeId?: string;
  oidcToken?: string;
}> {
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
}

function assertBlobConfigured() {
  if (!isBlobConfigured()) {
    throw new Error(
      "Blob is not configured. Connect a public Vercel Blob store, or set BLOB_READ_WRITE_TOKEN.",
    );
  }
}

type BlobHit = {
  url: string;
  pathname: string;
  uploadedAt: Date;
};

async function findBlob(pathname: string): Promise<BlobHit | null> {
  assertBlobConfigured();
  const auth = await blobAuth();
  const { blobs } = await list({ prefix: pathname, ...auth });
  const exact = blobs.find((b) => b.pathname === pathname);
  if (!exact) return null;
  return {
    url: exact.url,
    pathname: exact.pathname,
    uploadedAt: exact.uploadedAt,
  };
}

/** Bust Blob CDN cache — overwrites keep the same URL and default TTL is ~1 month. */
async function readJson<T>(url: string, bust?: string | number): Promise<T | null> {
  const separator = url.includes("?") ? "&" : "?";
  const target = bust != null ? `${url}${separator}v=${bust}` : url;
  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function putJson(pathname: string, data: unknown) {
  const auth = await blobAuth();
  return put(pathname, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: ARTICLE_CACHE_MAX_AGE,
    ...auth,
  });
}

type ArticleIndexItem = {
  slug: string;
  title: string;
  status: Article["status"];
  updatedAt: string;
  publishedAt: string | null;
  url: string;
};

async function readIndex(): Promise<ArticleIndexItem[] | null> {
  const hit = await findBlob(INDEX_PATH);
  if (!hit) return null;
  return readJson<ArticleIndexItem[]>(
    hit.url,
    hit.uploadedAt.getTime(),
  );
}

async function writeIndex(articles: Article[], urls: Record<string, string>) {
  const items: ArticleIndexItem[] = articles
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      status: a.status,
      updatedAt: a.updatedAt,
      publishedAt: a.publishedAt,
      url: urls[a.slug] || "",
    }))
    .filter((a) => a.url)
    .sort((a, b) => {
      const aTime = a.publishedAt ?? a.updatedAt;
      const bTime = b.publishedAt ?? b.updatedAt;
      return bTime.localeCompare(aTime);
    });
  await putJson(INDEX_PATH, items);
}

async function rebuildIndexFromBlobs(): Promise<Article[]> {
  const auth = await blobAuth();
  const { blobs } = await list({ prefix: ARTICLES_PREFIX, ...auth });
  const articleBlobs = blobs.filter(
    (b) => b.pathname.endsWith(".json") && b.pathname !== INDEX_PATH,
  );
  const articles = (
    await Promise.all(
      articleBlobs.map(async (b) => {
        const data = await readJson<Article>(b.url, b.uploadedAt.getTime());
        return data ? { article: data, url: b.url } : null;
      }),
    )
  ).filter((x): x is { article: Article; url: string } => Boolean(x));

  const listArticles = articles.map((x) => x.article);
  const urls = Object.fromEntries(articles.map((x) => [x.article.slug, x.url]));
  try {
    await writeIndex(listArticles, urls);
  } catch {
    // index write is best-effort
  }
  return listArticles;
}

export async function getHomeContent(): Promise<HomeContent> {
  const fallback: HomeContent = {
    title: "Blog",
    content:
      "A quiet place for notes, thoughts, and things worth keeping.\n\nSign in to write.",
    updatedAt: new Date(0).toISOString(),
  };

  if (!isBlobConfigured()) return fallback;

  try {
    const hit = await findBlob(HOME_PATH);
    if (!hit) return fallback;
    const data = await readJson<HomeContent>(hit.url, hit.uploadedAt.getTime());
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
  await putJson(HOME_PATH, payload);
  return payload;
}

export async function listArticles(options?: {
  includeDrafts?: boolean;
}): Promise<Article[]> {
  if (!isBlobConfigured()) return [];

  try {
    const index = await readIndex();
    let articles: Article[];

    if (index?.length) {
      // Index holds enough fields for the home list; hydrate lightly.
      articles = index.map((item) => ({
        id: item.slug,
        slug: item.slug,
        title: item.title,
        content: "",
        status: item.status,
        createdAt: item.updatedAt,
        updatedAt: item.updatedAt,
        publishedAt: item.publishedAt,
      }));
    } else {
      articles = await rebuildIndexFromBlobs();
    }

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
    // Prefer index URL (1 list for index + 1 fetch) then fallback to direct path.
    const index = await readIndex();
    const indexed = index?.find((i) => i.slug === slug);
    if (indexed?.url) {
      const data = await readJson<Article>(indexed.url, indexed.updatedAt);
      if (data) return data;
    }

    const hit = await findBlob(articlePath(slug));
    if (!hit) return null;
    return await readJson<Article>(hit.url, hit.uploadedAt.getTime());
  } catch {
    return null;
  }
}

async function ensureUniqueSlug(base: string, exclude?: string): Promise<string> {
  let candidate = base;
  let i = 2;
  const index = (await readIndex()) || [];
  const taken = new Set(index.map((a) => a.slug));

  while (true) {
    if (candidate === exclude) return candidate;
    if (!taken.has(candidate)) {
      // Double-check blob in case index is stale.
      const existing = await findBlob(articlePath(candidate));
      if (!existing || candidate === exclude) return candidate;
    }
    candidate = `${base}-${i}`;
    i += 1;
  }
}

async function upsertIndexEntry(article: Article, url: string) {
  const index = (await readIndex()) || [];
  const next = index.filter((i) => i.slug !== article.slug);
  next.push({
    slug: article.slug,
    title: article.title,
    status: article.status,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt,
    url,
  });
  next.sort((a, b) => {
    const aTime = a.publishedAt ?? a.updatedAt;
    const bTime = b.publishedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
  await putJson(INDEX_PATH, next);
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

  const result = await putJson(articlePath(slug), article);
  await upsertIndexEntry(article, result.url);
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
    const old = await findBlob(articlePath(existing.slug));
    if (old) await del(old.url, auth);
    // Drop old slug from index
    const index = (await readIndex()) || [];
    await putJson(
      INDEX_PATH,
      index.filter((i) => i.slug !== existing.slug),
    );
  }

  const result = await putJson(articlePath(nextSlug), article);
  await upsertIndexEntry(article, result.url);
  return article;
}

export async function deleteArticle(slug: string): Promise<boolean> {
  assertBlobConfigured();
  const hit = await findBlob(articlePath(slug));
  if (!hit) return false;
  const auth = await blobAuth();
  await del(hit.url, auth);
  const index = (await readIndex()) || [];
  await putJson(
    INDEX_PATH,
    index.filter((i) => i.slug !== slug),
  );
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
    cacheControlMaxAge: MEDIA_CACHE_MAX_AGE,
    ...auth,
  });
  return blob.url;
}
