import type { Article } from "./types";

export const TRASH_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

export type TrashedArticle = {
  deletedAt: string;
  article: Article;
};

export function trashExpiresAt(deletedAt: string): Date {
  return new Date(Date.parse(deletedAt) + TRASH_RETENTION_MS);
}

export function isTrashExpired(deletedAt: string, now = Date.now()): boolean {
  return now >= Date.parse(deletedAt) + TRASH_RETENTION_MS;
}
