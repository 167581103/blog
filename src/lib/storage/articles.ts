import { cache } from "react";
import { list } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { Article, ArticleInput } from "../types";
import { hasUnpublishedChanges } from "../types";
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
import { putArticleInTrash } from "./trash";

const ARTICLES_PREFIX = "articles/";
const INDEX_PATH = "articles/index.json";

function articlePath(slug: string) {
  return `${ARTICLES_PREFIX}${slug}.json`;
}

type ArticleIndexItem = {
  slug: string;
  /** Working title (admin list). */
  title: string;
  /** Live title for public list. */
  publishedTitle: string | null;
  status: Article["status"];
  categorySlug: string | null;
  hasUnpublishedChanges: boolean;
  pinnedAt: string | null;
  updatedAt: string;
  publishedAt: string | null;
  url: string;
};

function normalizeCategorySlug(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePinnedAt(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeArticle(data: Article): Article {
  return {
    ...data,
    categorySlug: normalizeCategorySlug(data.categorySlug),
    publishedTitle:
      typeof data.publishedTitle === "string" ? data.publishedTitle : null,
    publishedContent:
      typeof data.publishedContent === "string" ? data.publishedContent : null,
    pinnedAt: normalizePinnedAt(data.pinnedAt),
  };
}

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

function toIndexItem(article: Article, url: string): ArticleIndexItem {
  const normalized = normalizeArticle(article);
  return {
    slug: normalized.slug,
    title: normalized.title,
    publishedTitle:
      normalized.status === "published"
        ? (normalized.publishedTitle ?? normalized.title)
        : null,
    status: normalized.status,
    categorySlug: normalizeCategorySlug(normalized.categorySlug),
    hasUnpublishedChanges: hasUnpublishedChanges(normalized),
    pinnedAt: normalizePinnedAt(normalized.pinnedAt),
    updatedAt: normalized.updatedAt,
    publishedAt: normalized.publishedAt,
    url,
  };
}

async function writeIndex(articles: Article[], urls: Record<string, string>) {
  const items: ArticleIndexItem[] = sortIndex(
    articles
      .map((a) => toIndexItem(a, urls[a.slug] || ""))
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
        return data
          ? { article: normalizeArticle(data), url: b.url }
          : null;
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
      articles = index.map((item) => {
        const base: Article = {
          id: item.slug,
          slug: item.slug,
          title: item.title,
          content: "",
          status: item.status,
          categorySlug: normalizeCategorySlug(item.categorySlug),
          publishedTitle:
            item.status === "published"
              ? (item.publishedTitle ?? item.title)
              : null,
          // List rows don't load body; encode the edited flag so
          // hasUnpublishedChanges() still works for admin badges.
          publishedContent:
            item.status === "published"
              ? item.hasUnpublishedChanges
                ? "__pending__"
                : ""
              : null,
          pinnedAt: normalizePinnedAt(item.pinnedAt),
          createdAt: item.updatedAt,
          updatedAt: item.updatedAt,
          publishedAt: item.publishedAt,
        };
        return base;
      });
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
    const data = await readJsonByPath<Article>(articlePath(slug));
    if (!data) return null;
    return normalizeArticle(data);
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
  next.push(toIndexItem(article, url));
  return sortIndex(next);
}

export async function createArticle(input: ArticleInput): Promise<Article> {
  assertBlobConfigured();
  const now = new Date().toISOString();
  const baseSlug = slugify(input.slug?.trim() || input.title);
  const index = (await readIndex()) || [];
  const slug = await ensureUniqueSlug(baseSlug, undefined, index);
  const releasing = Boolean(input.release) || input.status === "published";
  const title = input.title.trim() || "Untitled";

  const article: Article = {
    id: randomUUID(),
    slug,
    title,
    content: input.content,
    status: releasing ? "published" : "draft",
    categorySlug:
      input.categorySlug !== undefined
        ? normalizeCategorySlug(input.categorySlug)
        : null,
    publishedTitle: releasing ? title : null,
    publishedContent: releasing ? input.content : null,
    pinnedAt: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: releasing ? now : null,
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

  const [existingRaw, index] = await Promise.all([
    getArticleUncached(slug),
    readIndex(),
  ]);
  if (!existingRaw) return null;
  const existing = normalizeArticle(existingRaw);

  const now = new Date().toISOString();
  const releasing = Boolean(input.release);
  const nextTitle = input.title.trim() || existing.title;
  const nextContent = input.content;

  // Keep public URL stable while editing a published article’s draft.
  const allowSlugChange =
    releasing || existing.status !== "published" || !existing.publishedAt;
  const nextBase = allowSlugChange
    ? slugify(input.slug?.trim() || nextTitle || existing.slug)
    : existing.slug;
  const nextSlug =
    nextBase === existing.slug
      ? existing.slug
      : await ensureUniqueSlug(nextBase, existing.slug, index);

  let publishedTitle = existing.publishedTitle;
  let publishedContent = existing.publishedContent;
  let publishedAt = existing.publishedAt;
  let status = input.status;

  if (releasing) {
    status = "published";
    publishedTitle = nextTitle;
    publishedContent = nextContent;
    publishedAt = existing.publishedAt ?? now;
  } else if (existing.status === "published" || status === "published") {
    // Saving a published article: lock the live snapshot if missing (migrate).
    status = "published";
    publishedTitle = existing.publishedTitle ?? existing.title;
    publishedContent = existing.publishedContent ?? existing.content;
    publishedAt = existing.publishedAt ?? now;
  } else {
    status = "draft";
    publishedTitle = null;
    publishedContent = null;
  }

  const article: Article = {
    ...existing,
    slug: nextSlug,
    title: nextTitle,
    content: nextContent,
    status,
    categorySlug:
      input.categorySlug !== undefined
        ? normalizeCategorySlug(input.categorySlug)
        : normalizeCategorySlug(existing.categorySlug),
    publishedTitle,
    publishedContent,
    updatedAt: now,
    publishedAt,
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

/** Move an article between columns without touching working/published body. */
export async function setArticleCategory(
  slug: string,
  categorySlug: string | null,
): Promise<Article | null> {
  assertBlobConfigured();
  const [existingRaw, index] = await Promise.all([
    getArticleUncached(slug),
    readIndex(),
  ]);
  if (!existingRaw) return null;
  const existing = normalizeArticle(existingRaw);
  const now = new Date().toISOString();
  const article: Article = {
    ...existing,
    categorySlug: normalizeCategorySlug(categorySlug),
    updatedAt: now,
  };
  const result = await putJson(articlePath(slug), article);
  await putJson(
    INDEX_PATH,
    upsertIndexItems(index || [], article, result.url),
  );
  return article;
}

/** Pin / unpin within the article's column (does not touch body). */
export async function setArticlePinned(
  slug: string,
  pinned: boolean,
): Promise<Article | null> {
  assertBlobConfigured();
  const [existingRaw, index] = await Promise.all([
    getArticleUncached(slug),
    readIndex(),
  ]);
  if (!existingRaw) return null;
  const existing = normalizeArticle(existingRaw);
  const now = new Date().toISOString();
  const article: Article = {
    ...existing,
    pinnedAt: pinned ? now : null,
    updatedAt: now,
  };
  const result = await putJson(articlePath(slug), article);
  await putJson(
    INDEX_PATH,
    upsertIndexItems(index || [], article, result.url),
  );
  return article;
}

/** Soft-delete: move into trash (30-day retention), remove from the live index. */
export async function deleteArticle(slug: string): Promise<boolean> {
  assertBlobConfigured();
  const existing = await getArticleUncached(slug);
  if (!existing) return false;

  const index = (await readIndex()) || [];
  await putArticleInTrash(existing);
  await Promise.all([
    deleteLogicalPath(articlePath(slug)),
    putJson(
      INDEX_PATH,
      index.filter((i) => i.slug !== slug),
    ),
  ]);
  return true;
}
