"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "../chrome/icons";
import { formatReleaseDate } from "@/lib/format-time";
import type { Article, Category } from "@/lib/types";
import { buildArticleGroups } from "./article-groups";

type Props = {
  articles: Article[];
  categories: Category[];
};

/**
 * Admin homepage sections: drag columns to reorder (snap blocks),
 * dashed + to create under that column, drafts visible in each column.
 */
export function AdminArticleSections({ articles, categories }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(categories);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [overSlug, setOverSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrder(categories);
  }, [categories]);

  const groups = buildArticleGroups(articles, order, { isAdmin: true });

  function moveBefore(fromSlug: string, toSlug: string) {
    if (fromSlug === toSlug) return order;
    const from = order.findIndex((c) => c.slug === fromSlug);
    const to = order.findIndex((c) => c.slug === toSlug);
    if (from < 0 || to < 0) return order;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    return next;
  }

  async function persistOrder(next: Category[]) {
    const previous = order;
    setOrder(next);
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: next.map((c) => c.slug) }),
      });
      if (!res.ok) {
        setOrder(previous);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setOrder(previous);
    }
  }

  let stagger = 0;

  return (
    <div className={`article-sections${pending ? " is-saving-order" : ""}`}>
      {groups.map((group) => {
        const isDragging = draggingSlug === group.categorySlug;
        const isOver =
          overSlug === group.categorySlug &&
          draggingSlug &&
          draggingSlug !== group.categorySlug;

        return (
          <section
            key={group.key}
            className={[
              "article-section",
              group.draggable ? "article-section-sortable" : "",
              isDragging ? "is-dragging" : "",
              isOver ? "is-drop-target" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(event) => {
              if (!group.draggable || !draggingSlug) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverSlug(group.categorySlug);
            }}
            onDragLeave={() => {
              if (overSlug === group.categorySlug) setOverSlug(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from =
                event.dataTransfer.getData("text/plain") || draggingSlug;
              setDraggingSlug(null);
              setOverSlug(null);
              if (!from || !group.categorySlug || from === group.categorySlug) {
                return;
              }
              const next = moveBefore(from, group.categorySlug);
              if (next !== order) void persistOrder(next);
            }}
          >
            <div
              className={[
                "article-section-head",
                "article-list-item",
                group.draggable ? "is-drag-handle" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ ["--i" as string]: stagger++ }}
              draggable={group.draggable}
              onDragStart={(event) => {
                if (!group.categorySlug) return;
                setDraggingSlug(group.categorySlug);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", group.categorySlug);
              }}
              onDragEnd={() => {
                setDraggingSlug(null);
                setOverSlug(null);
              }}
            >
              {group.title ? (
                <h2 className="article-section-title">{group.title}</h2>
              ) : (
                <h2 className="article-section-title is-muted">Loose</h2>
              )}
              <Link
                href={
                  group.categorySlug
                    ? `/articles/new?category=${encodeURIComponent(group.categorySlug)}`
                    : "/articles/new"
                }
                className="article-add-plus"
                prefetch
                aria-label={
                  group.title
                    ? `Add article in ${group.title}`
                    : "Add article"
                }
                title="Add article"
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
              >
                <PlusIcon className="h-4 w-4" />
              </Link>
            </div>

            {group.items.length ? (
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
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                      >
                        <span className="article-link-title">
                          {article.title}
                        </span>
                        {article.status === "draft" ? (
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
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
