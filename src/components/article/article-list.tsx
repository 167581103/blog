import Link from "next/link";
import { formatReleaseDate } from "@/lib/format-time";
import type { Article, Category } from "@/lib/types";

/** Server-friendly list — CSS stagger, no client JS. Grouped by column. */
export function ArticleList({
  articles,
  categories,
  isAdmin,
}: {
  articles: Article[];
  categories: Category[];
  isAdmin: boolean;
}) {
  if (!articles.length && !isAdmin) {
    return <p className="muted page-fade">No articles yet.</p>;
  }

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const groups: { key: string; title: string | null; items: Article[] }[] = [];

  for (const category of categories) {
    const items = articles.filter((a) => a.categorySlug === category.slug);
    if (!items.length) continue;
    groups.push({ key: category.slug, title: category.name, items });
  }

  const uncategorized = articles.filter(
    (a) => !a.categorySlug || !bySlug.has(a.categorySlug),
  );
  if (uncategorized.length) {
    groups.push({ key: "_none", title: null, items: uncategorized });
  }

  let stagger = 0;

  return (
    <div className="article-sections">
      {isAdmin ? (
        <div
          className="article-list-item"
          style={{ ["--i" as string]: stagger++ }}
        >
          <Link href="/articles/new" className="article-add" prefetch>
            add a new article
          </Link>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="article-section">
          {group.title ? (
            <h2
              className="article-section-title article-list-item"
              style={{ ["--i" as string]: stagger++ }}
            >
              {group.title}
            </h2>
          ) : null}
          <ul className="article-list">
            {group.items.map((article) => {
              const releaseDate =
                article.status === "published"
                  ? formatReleaseDate(article.publishedAt)
                  : null;
              const i = stagger++;
              return (
                <li
                  key={article.id}
                  className="article-list-item"
                  style={{ ["--i" as string]: i }}
                >
                  <Link
                    href={`/articles/${article.slug}`}
                    className="article-link"
                    prefetch
                  >
                    <span className="article-link-title">{article.title}</span>
                    {isAdmin && article.status === "draft" ? (
                      <span className="draft-tag">draft</span>
                    ) : releaseDate ? (
                      <time
                        className="article-release-date"
                        dateTime={article.publishedAt ?? undefined}
                      >
                        {releaseDate}
                      </time>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
