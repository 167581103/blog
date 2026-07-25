import { cache } from "react";
import { list, put, del, get, head } from "@vercel/blob";
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

/** Per-request auth memo (React cache). */
const blobAuth = cache(async (): Promise<{
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

function assertBlobConfigured() {
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
 * Read JSON by pathname via Blob get().
 * useCache:false bypasses CDN so overwrites are visible immediately (no list + ?v= bust).
 */
async function readJsonByPath<T>(pathname: string): Promise<T | null> {
  assertBlobConfigured();
  const auth = await blobAuth();
  const result = await get(pathname, {
    access: "public",
    useCache: false,
    ...auth,
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return streamToJson<T>(result.stream);
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

function sortIndex(items: ArticleIndexItem[]) {
  return items.sort((a, b) => {
    const aTime = a.publishedAt ?? a.updatedAt;
    const bTime = b.publishedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
}

async function readIndex(): Promise<ArticleIndexItem[] | null> {
  return readJsonByPath<ArticleIndexItem[]>(INDEX_PATH);
}

async function writeIndex(articles: Article[], urls: Record<string, string>) {
  const items: ArticleIndexItem[] = sortIndex(
    articles
      .map((a) => ({
        slug: a.slug,
        title: a.title,
        status: a.status,
        updatedAt: a.updatedAt,
        publishedAt: a.publishedAt,
        url: urls[a.slug] || "",
      }))
      .filter((a) => a.url),
  );
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
        // Origin read — avoid stale CDN after rebuild
        const data = await readJsonByPath<Article>(b.pathname);
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

async function getHomeContentUncached(): Promise<HomeContent> {
  const fallback: HomeContent = {
    title: "Blog",
    content:
      "A quiet place for notes, thoughts, and things worth keeping.\n\nSign in to write.",
    updatedAt: new Date(0).toISOString(),
  };

  if (!isBlobConfigured()) return fallback;

  try {
    const data = await readJsonByPath<HomeContent>(HOME_PATH);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export const getHomeContent = cache(getHomeContentUncached);

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

async function listArticlesUncached(options?: {
  includeDrafts?: boolean;
}): Promise<Article[]> {
  if (!isBlobConfigured()) return [];

  try {
    const index = await readIndex();
    let articles: Article[];

    if (index?.length) {
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

/** Request-deduped list. Always pass stable options. */
export const listArticles = cache(
  async (includeDrafts = false): Promise<Article[]> =>
    listArticlesUncached({ includeDrafts }),
);

async function getArticleUncached(slug: string): Promise<Article | null> {
  if (!isBlobConfigured()) return null;

  try {
    // Direct pathname get — 1 origin round-trip (no list, no index hop).
    return await readJsonByPath<Article>(articlePath(slug));
  } catch {
    return null;
  }
}

export const getArticle = cache(getArticleUncached);

async function pathExists(pathname: string): Promise<boolean> {
  try {
    const auth = await blobAuth();
    await head(pathname, auth);
    return true;
  } catch {
    return false;
  }
}

async function ensureUniqueSlug(
  base: string,
  exclude?: string,
  index?: ArticleIndexItem[] | null,
): Promise<string> {
  let candidate = base;
  let i = 2;
  const items = index ?? (await readIndex()) ?? [];
  const taken = new Set(items.map((a) => a.slug));

  while (true) {
    if (candidate === exclude) return candidate;
    if (!taken.has(candidate)) {
      const exists = await pathExists(articlePath(candidate));
      if (!exists || candidate === exclude) return candidate;
    }
    candidate = `${base}-${i}`;
    i += 1;
  }
}

function upsertIndexItems(
  index: ArticleIndexItem[],
  article: Article,
  url: string,
  dropSlug?: string,
): ArticleIndexItem[] {
  const next = index.filter(
    (i) => i.slug !== article.slug && i.slug !== dropSlug,
  );
  next.push({
    slug: article.slug,
    title: article.title,
    status: article.status,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt,
    url,
  });
  return sortIndex(next);
}

export async function createArticle(input: ArticleInput): Promise<Article> {
  assertBlobConfigured();
  const now = new Date().toISOString();
  const baseSlug = slugify(input.slug?.trim() || input.title);
  const index = (await readIndex()) || [];
  const slug = await ensureUniqueSlug(baseSlug, undefined, index);

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
  // Index write in parallel with nothing else needed — fire after put for URL.
  await putJson(INDEX_PATH, upsertIndexItems(index, article, result.url));
  return article;
}

export async function updateArticle(
  slug: string,
  input: ArticleInput,
): Promise<Article | null> {
  assertBlobConfigured();

  // Parallel: load article + index once.
  const [existing, index] = await Promise.all([
    getArticleUncached(slug),
    readIndex(),
  ]);
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextBase = slugify(input.slug?.trim() || input.title || existing.slug);
  const slugUnchanged = nextBase === existing.slug;
  const nextSlug = slugUnchanged
    ? existing.slug
    : await ensureUniqueSlug(nextBase, existing.slug, index);

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
  const currentIndex = index || [];
  const priorUrl =
    currentIndex.find((i) => i.slug === existing.slug)?.url || "";

  if (nextSlug !== existing.slug) {
    // Rename: write new, delete old, update index — put new + index together after we know URL.
    const result = await putJson(articlePath(nextSlug), article);
    await Promise.all([
      putJson(
        INDEX_PATH,
        upsertIndexItems(currentIndex, article, result.url, existing.slug),
      ),
      del(articlePath(existing.slug), auth).catch(() => undefined),
    ]);
    return article;
  }

  // Fast path: same slug — article + index in parallel when URL already known.
  if (priorUrl) {
    await Promise.all([
      putJson(articlePath(nextSlug), article),
      putJson(
        INDEX_PATH,
        upsertIndexItems(currentIndex, article, priorUrl),
      ),
    ]);
    return article;
  }

  const result = await putJson(articlePath(nextSlug), article);
  await putJson(
    INDEX_PATH,
    upsertIndexItems(currentIndex, article, result.url),
  );
  return article;
}

export async function deleteArticle(slug: string): Promise<boolean> {
  assertBlobConfigured();
  const auth = await blobAuth();
  const exists = await pathExists(articlePath(slug));
  if (!exists) return false;

  const index = (await readIndex()) || [];
  await Promise.all([
    del(articlePath(slug), auth),
    putJson(
      INDEX_PATH,
      index.filter((i) => i.slug !== slug),
    ),
  ]);
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
