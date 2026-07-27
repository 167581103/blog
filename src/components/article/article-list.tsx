import Link from "next/link";
import type { CategoryLayout } from "@/lib/category-layout";
import { formatReleaseDate } from "@/lib/format-time";
import { publicTitle, type Article } from "@/lib/types";
import { buildArticleRows } from "./article-groups";

/** Public homepage list — row layout, no drag chrome. */
export function ArticleList({
  articles,
  layout,
}: {
  articles: Article[];
  layout: CategoryLayout;
}) {
  const { rows, loose } = buildArticleRows(articles, layout, { isAdmin: false });

  if (!rows.length && !loose) {
    return <p className="muted page-fade">No articles yet.</p>;
  }

  let stagger = 0;

  return (
    <div className="article-rows">
      {rows.map((row) => (
        <div
          key={row.key}
          className="article-row"
          style={{ ["--cols" as string]: row.groups.length }}
        >
          {row.groups.map((group) => (
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
                  const releaseDate = formatReleaseDate(article.publishedAt);
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
                        <span className="article-link-title">
                          {publicTitle(article)}
                        </span>
                        {releaseDate ? (
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
      ))}

      {loose ? (
        <div className="article-row" style={{ ["--cols" as string]: 1 }}>
          <section className="article-section">
            <ul className="article-list">
              {loose.items.map((article) => {
                const releaseDate = formatReleaseDate(article.publishedAt);
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
                      <span className="article-link-title">
                        {publicTitle(article)}
                      </span>
                      {releaseDate ? (
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
        </div>
      ) : null}
    </div>
  );
}
