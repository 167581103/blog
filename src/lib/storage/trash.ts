import type { Article } from "../types";
import {
  isTrashExpired,
  type TrashedArticle,
  TRASH_RETENTION_MS,
} from "../trash";
import {
  assertDocStoreConfigured,
  deleteDoc,
  isDocStoreConfigured,
  listDocPaths,
  readDoc,
  writeDoc,
} from "./docs";

const TRASH_PREFIX = "trash/articles/";

export function trashArticlePath(slug: string) {
  return `${TRASH_PREFIX}${slug}.json`;
}

export async function putArticleInTrash(article: Article): Promise<TrashedArticle> {
  assertDocStoreConfigured();
  const payload: TrashedArticle = {
    deletedAt: new Date().toISOString(),
    article,
  };
  await writeDoc(trashArticlePath(article.slug), payload);
  return payload;
}

export async function getTrashedArticle(
  slug: string,
): Promise<TrashedArticle | null> {
  if (!isDocStoreConfigured()) return null;
  try {
    return await readDoc<TrashedArticle>(trashArticlePath(slug));
  } catch {
    return null;
  }
}

export async function listTrashedArticles(): Promise<TrashedArticle[]> {
  if (!isDocStoreConfigured()) return [];
  const paths = await listDocPaths(TRASH_PREFIX);
  const items = await Promise.all(
    paths
      .filter((path) => path.endsWith(".json"))
      .map((path) => readDoc<TrashedArticle>(path)),
  );
  return items.filter((item): item is TrashedArticle => Boolean(item?.article));
}

/** Hard-delete trash entries older than the retention window. */
export async function purgeExpiredTrash(now = Date.now()): Promise<{
  purged: string[];
  retained: number;
  retentionMs: number;
}> {
  assertDocStoreConfigured();
  const items = await listTrashedArticles();
  const purged: string[] = [];
  let retained = 0;

  for (const item of items) {
    const slug = item.article.slug;
    if (isTrashExpired(item.deletedAt, now)) {
      await deleteDoc(trashArticlePath(slug));
      purged.push(slug);
    } else {
      retained += 1;
    }
  }

  return { purged, retained, retentionMs: TRASH_RETENTION_MS };
}
