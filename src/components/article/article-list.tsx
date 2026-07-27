import Link from "next/link";
import { formatReleaseDate } from "@/lib/format-time";
import { publicTitle, type Article, type Category } from "@/lib/types";
import { buildArticleGroups } from "./article-groups";

/** Public homepage list — server component, no drag chrome. */
export function ArticleList({
  articles,
  categories,
}: {
  articles: Article[];
  categories: Category[];
}) {
  const groups = buildArticleGroups(articles, categories, { isAdmin: false });

  if (!groups.length) {
    return <p className="muted page-fade">No articles yet.</p>;
  }

  let stagger = 0;

  return (
    <div className="article-sections">
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
  );
}
