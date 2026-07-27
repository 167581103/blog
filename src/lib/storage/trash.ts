import { list } from "@vercel/blob";
import type { Article } from "../types";
import {
  isTrashExpired,
  type TrashedArticle,
  TRASH_RETENTION_MS,
} from "../trash";
import {
  assertBlobConfigured,
  blobAuth,
  deleteLogicalPath,
  isBlobConfigured,
  putJson,
  readJsonByPath,
} from "./blob";

const TRASH_PREFIX = "trash/articles/";

export function trashArticlePath(slug: string) {
  return `${TRASH_PREFIX}${slug}.json`;
}

export async function putArticleInTrash(article: Article): Promise<TrashedArticle> {
  assertBlobConfigured();
  const payload: TrashedArticle = {
    deletedAt: new Date().toISOString(),
    article,
  };
  await putJson(trashArticlePath(article.slug), payload);
  return payload;
}

export async function getTrashedArticle(
  slug: string,
): Promise<TrashedArticle | null> {
  if (!isBlobConfigured()) return null;
  try {
    return await readJsonByPath<TrashedArticle>(trashArticlePath(slug));
  } catch {
    return null;
  }
}

export async function listTrashedArticles(): Promise<TrashedArticle[]> {
  if (!isBlobConfigured()) return [];
  const auth = await blobAuth();
  const { blobs } = await list({ prefix: TRASH_PREFIX, ...auth });
  const files = blobs.filter(
    (b) => b.pathname.endsWith(".json") && !b.pathname.includes(".rev/"),
  );
  const items = await Promise.all(
    files.map((b) => readJsonByPath<TrashedArticle>(b.pathname)),
  );
  return items.filter((item): item is TrashedArticle => Boolean(item?.article));
}

/** Hard-delete trash entries older than the retention window. */
export async function purgeExpiredTrash(now = Date.now()): Promise<{
  purged: string[];
  retained: number;
  retentionMs: number;
}> {
  assertBlobConfigured();
  const items = await listTrashedArticles();
  const purged: string[] = [];
  let retained = 0;

  for (const item of items) {
    const slug = item.article.slug;
    if (isTrashExpired(item.deletedAt, now)) {
      await deleteLogicalPath(trashArticlePath(slug));
      purged.push(slug);
    } else {
      retained += 1;
    }
  }

  return { purged, retained, retentionMs: TRASH_RETENTION_MS };
}
