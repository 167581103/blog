import { cache } from "react";
import { list } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { Article, ArticleInput } from "../types";
import { slugify } from "../slug";
import {
  assertBlobConfigured,
  blobAuth,
  deleteLogicalPath,
  isBlobConfigured,
  pathExists,
  putJson,
  readJsonByPath,
} from "./blob";

const ARTICLES_PREFIX = "articles/";
const INDEX_PATH = "articles/index.json";

function articlePath(slug: string) {
  return `${ARTICLES_PREFIX}${slug}.json`;
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
    (b) =>
      b.pathname.endsWith(".json") &&
      b.pathname !== INDEX_PATH &&
      !b.pathname.includes(".rev/"),
  );
  const articles = (
    await Promise.all(
      articleBlobs.map(async (b) => {
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
    return await readJsonByPath<Article>(articlePath(slug));
  } catch {
    return null;
  }
}

export const getArticle = cache(getArticleUncached);

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
  await putJson(INDEX_PATH, upsertIndexItems(index, article, result.url));
  return article;
}

export async function updateArticle(
  slug: string,
  input: ArticleInput,
): Promise<Article | null> {
  assertBlobConfigured();

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

  const currentIndex = index || [];

  if (nextSlug !== existing.slug) {
    const result = await putJson(articlePath(nextSlug), article);
    await Promise.all([
      putJson(
        INDEX_PATH,
        upsertIndexItems(currentIndex, article, result.url, existing.slug),
      ),
      deleteLogicalPath(articlePath(existing.slug)),
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
  const exists = await pathExists(articlePath(slug));
  if (!exists) return false;

  const index = (await readIndex()) || [];
  await Promise.all([
    deleteLogicalPath(articlePath(slug)),
    putJson(
      INDEX_PATH,
      index.filter((i) => i.slug !== slug),
    ),
  ]);
  return true;
}
