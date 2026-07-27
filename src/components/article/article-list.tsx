import Link from "next/link";
import { formatReleaseDate } from "@/lib/format-time";
import type { Article } from "@/lib/types";

/** Server-friendly list — CSS stagger, no client JS. */
export function ArticleList({
  articles,
  isAdmin,
}: {
  articles: Article[];
  isAdmin: boolean;
}) {
  if (!articles.length && !isAdmin) {
    return <p className="muted page-fade">No articles yet.</p>;
  }

  return (
    <ul className="article-list">
      {isAdmin ? (
        <li className="article-list-item" style={{ ["--i" as string]: 0 }}>
          <Link href="/articles/new" className="article-add" prefetch>
            add a new article
          </Link>
        </li>
      ) : null}

      {articles.map((article, index) => {
        const releaseDate =
          article.status === "published"
            ? formatReleaseDate(article.publishedAt)
            : null;

        return (
          <li
            key={article.id}
            className="article-list-item"
            style={{ ["--i" as string]: isAdmin ? index + 1 : index }}
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
  );
}
