import type { CategoryLayout } from "@/lib/category-layout";
import type { Article, Category } from "@/lib/types";

export type ArticleGroup = {
  key: string;
  categorySlug: string | null;
  title: string | null;
  items: Article[];
  /** Named columns are reorderable; the loose uncategorized bucket is not. */
  draggable: boolean;
};

export type ArticleRow = {
  key: string;
  groups: ArticleGroup[];
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

function groupForCategory(
  articles: Article[],
  category: Category,
  isAdmin: boolean,
): ArticleGroup | null {
  const items = sortArticlesInGroup(
    articles.filter((a) => a.categorySlug === category.slug),
    isAdmin,
  );
  if (!isAdmin && !items.length) return null;
  return {
    key: category.slug,
    categorySlug: category.slug,
    title: category.name,
    items,
    draggable: true,
  };
}

/**
 * Build homepage rows from the stored category layout.
 * Admin keeps empty columns so they can drag / add.
 * Public drops empty columns; a row with no visible columns is omitted.
 */
export function buildArticleRows(
  articles: Article[],
  layout: CategoryLayout,
  opts: { isAdmin: boolean },
): { rows: ArticleRow[]; loose: ArticleGroup | null } {
  const bySlug = new Map(layout.categories.map((c) => [c.slug, c]));
  const rows: ArticleRow[] = [];

  layout.rows.forEach((rowSlugs, rowIndex) => {
    const groups: ArticleGroup[] = [];
    for (const slug of rowSlugs) {
      const category = bySlug.get(slug);
      if (!category) continue;
      const group = groupForCategory(articles, category, opts.isAdmin);
      if (group) groups.push(group);
    }
    if (!groups.length) return;
    rows.push({ key: `row-${rowIndex}-${rowSlugs.join("-")}`, groups });
  });

  const uncategorized = sortArticlesInGroup(
    articles.filter((a) => !a.categorySlug || !bySlug.has(a.categorySlug)),
    opts.isAdmin,
  );
  const loose: ArticleGroup | null =
    uncategorized.length || (opts.isAdmin && !layout.categories.length)
      ? {
          key: "_none",
          categorySlug: null,
          title: null,
          items: uncategorized,
          draggable: false,
        }
      : null;

  return { rows, loose };
}

/** @deprecated Prefer buildArticleRows. Flat list for simple callers. */
export function buildArticleGroups(
  articles: Article[],
  categories: Category[],
  opts: { isAdmin: boolean },
): ArticleGroup[] {
  const layout: CategoryLayout = {
    categories,
    rows: categories.map((c) => [c.slug]),
  };
  const { rows, loose } = buildArticleRows(articles, layout, opts);
  const groups = rows.flatMap((row) => row.groups);
  if (loose) groups.push(loose);
  return groups;
}
