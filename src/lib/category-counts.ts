import type { Article } from "@/lib/types";

/** Count live articles per category slug (Loose / null excluded). */
export function countArticlesByCategory(
  articles: Article[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const article of articles) {
    if (!article.categorySlug) continue;
    counts[article.categorySlug] = (counts[article.categorySlug] ?? 0) + 1;
  }
  return counts;
}
