import type { Article, Category } from "@/lib/types";

export type ArticleGroup = {
  key: string;
  categorySlug: string | null;
  title: string | null;
  items: Article[];
  /** Named columns are reorderable; the loose uncategorized bucket is not. */
  draggable: boolean;
};

export function sortArticlesInGroup(
  items: Article[],
  preferDraftsFirst: boolean,
): Article[] {
  return [...items].sort((a, b) => {
    if (preferDraftsFirst && a.status !== b.status) {
      return a.status === "draft" ? -1 : 1;
    }
    const aTime = a.publishedAt ?? a.updatedAt;
    const bTime = b.publishedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
}

/**
 * Build homepage sections in category order.
 * Admin sees every column (even empty) so they can drag / add.
 * Public only sees columns that have visible articles.
 */
export function buildArticleGroups(
  articles: Article[],
  categories: Category[],
  opts: { isAdmin: boolean },
): ArticleGroup[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const groups: ArticleGroup[] = [];

  for (const category of categories) {
    const items = sortArticlesInGroup(
      articles.filter((a) => a.categorySlug === category.slug),
      opts.isAdmin,
    );
    if (!opts.isAdmin && !items.length) continue;
    groups.push({
      key: category.slug,
      categorySlug: category.slug,
      title: category.name,
      items,
      draggable: true,
    });
  }

  const uncategorized = sortArticlesInGroup(
    articles.filter((a) => !a.categorySlug || !bySlug.has(a.categorySlug)),
    opts.isAdmin,
  );
  if (uncategorized.length || (opts.isAdmin && !categories.length)) {
    groups.push({
      key: "_none",
      categorySlug: null,
      title: null,
      items: uncategorized,
      draggable: false,
    });
  }

  return groups;
}
