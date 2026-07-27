"use client";

import { useMemo } from "react";
import { extractMarkdownOutline } from "@/lib/markdown-headings";

type Props = {
  content: string;
  /** When true, titles link to heading anchors (read page). */
  linkable?: boolean;
};

/**
 * Compact heading outline — titles only, indented by level.
 * Hidden when the body has fewer than two headings.
 */
export function ArticleOutline({ content, linkable = false }: Props) {
  const headings = useMemo(
    () => extractMarkdownOutline(content),
    [content],
  );

  if (headings.length < 2) return null;

  return (
    <nav className="article-outline" aria-label="Outline">
      <p className="article-outline-label">Outline</p>
      <ol className="article-outline-list">
        {headings.map((heading) => (
          <li
            key={`${heading.id}-${heading.level}`}
            className={`article-outline-item is-h${heading.level}`}
          >
            {linkable ? (
              <a href={`#${heading.id}`}>{heading.text}</a>
            ) : (
              <span>{heading.text}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
