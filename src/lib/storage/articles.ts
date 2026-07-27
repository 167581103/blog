import { cache } from "react";
import { list } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { Article, ArticleInput } from "../types";
import { hasUnpublishedChanges } from "../types";
import { slugify } from "../slug";
import {
  assertBlobConfigured,
  blobAuth,
  blobHostKind,
  deleteLogicalPath,
  isBlobConfigured,
  pathExists,
  publicBlobUrl,
  putJson,
  readBlobJson,
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

function normalizeArticle(data: Article): Article {
  return {
    ...data,
    categorySlug: normalizeCategorySlug(data.categorySlug),
    publishedTitle:
      typeof data.publishedTitle === "string" ? data.publishedTitle : null,
    publishedContent:
      typeof data.publishedContent === "string" ? data.publishedContent : null,
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

/** An empty/missing index can mean a lost mirror, but rebuilds are costly. */
const REBUILD_TTL = 5 * 60 * 1000;
let lastRebuildAt = 0;

function shouldRebuild() {
  if (Date.now() - lastRebuildAt < REBUILD_TTL) return false;
  lastRebuildAt = Date.now();
  return true;
}

/** Logical article path for a canonical blob or a `<path>.rev/<file>` entry. */
function logicalArticlePath(pathname: string): string | null {
  const revAt = pathname.indexOf(".json.rev/");
  const logical = revAt >= 0 ? pathname.slice(0, revAt + ".json".length) : pathname;
  if (!logical.endsWith(".json")) return null;
  if (logical === INDEX_PATH) return null;
  return logical;
}

/**
 * Last-resort rebuild via a single Advanced `list()`. Handles stores where the
 * canonical mirror is missing and only `<path>.rev/` snapshots survived, then
 * rewrites the mirrors so later reads stay on the cheap CDN path.
 */
async function rebuildIndexFromBlobs(): Promise<Article[]> {
  let listed: { pathname: string; url: string; uploadedAt: Date }[];
  try {
    const auth = await blobAuth();
    const { blobs } = await list({ prefix: ARTICLES_PREFIX, ...auth });
    listed = blobs;
  } catch (error) {
    console.warn(
      "[blob] article-rebuild-list-failed",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
    return [];
  }

  // Newest blob per logical article path, canonical or revision.
  const newestByPath = new Map<
    string,
    { pathname: string; url: string; uploadedAt: Date }
  >();
  for (const blob of listed) {
    const logical = logicalArticlePath(blob.pathname);
    if (!logical) continue;
    const current = newestByPath.get(logical);
    const isCanonical = blob.pathname === logical;
    // Canonical wins ties so a fresh mirror is preferred over old snapshots.
    if (
      !current ||
      blob.uploadedAt.getTime() > current.uploadedAt.getTime() ||
      (isCanonical &&
        blob.uploadedAt.getTime() === current.uploadedAt.getTime())
    ) {
      newestByPath.set(logical, {
        pathname: blob.pathname,
        url: blob.url,
        uploadedAt: blob.uploadedAt,
      });
    }
  }

  const recovered = (
    await Promise.all(
      [...newestByPath].map(async ([logical, blob]) => {
        const { data } = await readBlobJson<Article>(blob.pathname);
        if (!data?.slug) return null;
        return { logical, article: normalizeArticle(data), url: blob.url };
      }),
    )
  ).filter(
    (x): x is { logical: string; article: Article; url: string } => Boolean(x),
  );

  console.warn(
    "[blob] article-rebuild",
    JSON.stringify({
      listed: listed.length,
      candidates: newestByPath.size,
      recovered: recovered.length,
      hostKind: listed.length ? blobHostKind(listed[0].url) : "none",
    }),
  );

  // Restore canonical mirrors so the next request avoids list() entirely.
  await Promise.all(
    recovered.map((x) =>
      putJson(articlePath(x.article.slug), x.article).catch(() => undefined),
    ),
  );

  const rebuilt = recovered.map((x) => x.article);
  const urls = Object.fromEntries(
    recovered.map((x) => [x.article.slug, publicArticleUrl(x)]),
  );
  try {
    await writeIndex(rebuilt, urls);
  } catch {
    // index write is best-effort (may fail if Advanced is frozen)
  }
  return rebuilt;
}

/** Canonical public URL when resolvable, else the blob URL we just read. */
function publicArticleUrl(entry: { article: Article; url: string }) {
  return publicBlobUrl(articlePath(entry.article.slug)) || entry.url;
}

async function listArticlesUncached(options?: {
  includeDrafts?: boolean;
}): Promise<Article[]> {
  if (!isBlobConfigured()) return [];

  try {
    const index = await readIndex();
    let articles: Article[];

    // A missing or empty index may just be a lost canonical mirror, so try one
    // guarded rebuild; a populated index always wins and costs no list().
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
          createdAt: item.updatedAt,
          updatedAt: item.updatedAt,
          publishedAt: item.publishedAt,
        };
        return base;
      });
    } else if (shouldRebuild()) {
      articles = await rebuildIndexFromBlobs();
    } else {
      articles = [];
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
