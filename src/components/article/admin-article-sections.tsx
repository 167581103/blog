"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "../chrome/icons";
import {
  appendCategoryToRow,
  insertCategoryAsRow,
  moveCategoryBefore,
  type CategoryLayout,
} from "@/lib/category-layout";
import { formatReleaseDate } from "@/lib/format-time";
import {
  hasUnpublishedChanges,
  type Article,
} from "@/lib/types";
import { buildArticleRows, type ArticleGroup } from "./article-groups";

type Props = {
  articles: Article[];
  layout: CategoryLayout;
};

type DropTarget =
  | { kind: "before"; slug: string }
  | { kind: "append"; rowIndex: number }
  | { kind: "new-row"; rowIndex: number };

/**
 * Admin homepage: row-based columns (1–3 per row), drag to place freely.
 * New columns default to their own full-width row (classic stack).
 */
export function AdminArticleSections({ articles, layout }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(layout.rows);
  const [categories, setCategories] = useState(layout.categories);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRows(layout.rows);
    setCategories(layout.categories);
  }, [layout]);

  const currentLayout: CategoryLayout = { categories, rows };
  const { rows: articleRows, loose } = buildArticleRows(articles, currentLayout, {
    isAdmin: true,
  });

  async function persistRows(nextRows: string[][]) {
    const previous = rows;
    setRows(nextRows);
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: nextRows }),
      });
      if (!res.ok) {
        setRows(previous);
        return;
      }
      const data = (await res.json()) as CategoryLayout;
      if (Array.isArray(data.rows)) setRows(data.rows);
      if (Array.isArray(data.categories)) setCategories(data.categories);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setRows(previous);
    }
  }

  function applyDrop(from: string, target: DropTarget) {
    let next: string[][];
    if (target.kind === "before") {
      next = moveCategoryBefore(rows, from, target.slug);
    } else if (target.kind === "append") {
      next = appendCategoryToRow(rows, from, target.rowIndex);
    } else {
      next = insertCategoryAsRow(rows, from, target.rowIndex);
    }
    if (JSON.stringify(next) !== JSON.stringify(rows)) {
      void persistRows(next);
    }
  }

  let stagger = 0;

  return (
    <div className={`article-sections-wrap${pending ? " is-saving-order" : ""}`}>
      <div
        className="article-list-item"
        style={{ ["--i" as string]: stagger++ }}
      >
        <Link href="/articles/new" className="article-add" prefetch>
          add a new article
        </Link>
      </div>

      <div className="article-rows">
        {articleRows.map((row, visualIndex) => {
          // Map visual row back to layout row index via first draggable slug.
          const anchorSlug = row.groups.find((g) => g.categorySlug)?.categorySlug;
          const layoutRowIndex = anchorSlug
            ? rows.findIndex((r) => r.includes(anchorSlug))
            : visualIndex;
          const cols = row.groups.length;

          return (
            <div key={row.key}>
              {draggingSlug ? (
                <div
                  className={`article-row-insert${
                    dropTarget?.kind === "new-row" &&
                    dropTarget.rowIndex === layoutRowIndex
                      ? " is-active"
                      : ""
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget({ kind: "new-row", rowIndex: layoutRowIndex });
                  }}
                  onDragLeave={() => {
                    setDropTarget((current) =>
                      current?.kind === "new-row" &&
                      current.rowIndex === layoutRowIndex
                        ? null
                        : current,
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from =
                      event.dataTransfer.getData("text/plain") || draggingSlug;
                    setDraggingSlug(null);
                    setDropTarget(null);
                    if (!from) return;
                    applyDrop(from, {
                      kind: "new-row",
                      rowIndex: layoutRowIndex,
                    });
                  }}
                />
              ) : null}

              <div
                className="article-row"
                style={{ ["--cols" as string]: cols }}
              >
                {row.groups.map((group) => (
                  <CategorySection
                    key={group.key}
                    group={group}
                    stagger={stagger++}
                    draggingSlug={draggingSlug}
                    dropTarget={dropTarget}
                    onDragStart={(slug) => setDraggingSlug(slug)}
                    onDragEnd={() => {
                      setDraggingSlug(null);
                      setDropTarget(null);
                    }}
                    onDragOverBefore={(slug) =>
                      setDropTarget({ kind: "before", slug })
                    }
                    onDropBefore={(from, slug) => {
                      setDraggingSlug(null);
                      setDropTarget(null);
                      applyDrop(from, { kind: "before", slug });
                    }}
                  />
                ))}

                {draggingSlug &&
                layoutRowIndex >= 0 &&
                (rows[layoutRowIndex]?.length ?? 0) < 3 &&
                !rows[layoutRowIndex]?.includes(draggingSlug) ? (
                  <div
                    className={`article-row-append${
                      dropTarget?.kind === "append" &&
                      dropTarget.rowIndex === layoutRowIndex
                        ? " is-active"
                        : ""
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTarget({
                        kind: "append",
                        rowIndex: layoutRowIndex,
                      });
                    }}
                    onDragLeave={() => {
                      setDropTarget((current) =>
                        current?.kind === "append" &&
                        current.rowIndex === layoutRowIndex
                          ? null
                          : current,
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from =
                        event.dataTransfer.getData("text/plain") ||
                        draggingSlug;
                      setDraggingSlug(null);
                      setDropTarget(null);
                      if (!from) return;
                      applyDrop(from, {
                        kind: "append",
                        rowIndex: layoutRowIndex,
                      });
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        {draggingSlug ? (
          <div
            className={`article-row-insert${
              dropTarget?.kind === "new-row" && dropTarget.rowIndex === rows.length
                ? " is-active"
                : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTarget({ kind: "new-row", rowIndex: rows.length });
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from =
                event.dataTransfer.getData("text/plain") || draggingSlug;
              setDraggingSlug(null);
              setDropTarget(null);
              if (!from) return;
              applyDrop(from, { kind: "new-row", rowIndex: rows.length });
            }}
          />
        ) : null}
      </div>

      {loose ? (
        <div className="article-rows">
          <div className="article-row" style={{ ["--cols" as string]: 1 }}>
            <CategorySection
              group={loose}
              stagger={stagger++}
              draggingSlug={null}
              dropTarget={null}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onDragOverBefore={() => {}}
              onDropBefore={() => {}}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategorySection({
  group,
  stagger,
  draggingSlug,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOverBefore,
  onDropBefore,
}: {
  group: ArticleGroup;
  stagger: number;
  draggingSlug: string | null;
  dropTarget: DropTarget | null;
  onDragStart: (slug: string) => void;
  onDragEnd: () => void;
  onDragOverBefore: (slug: string) => void;
  onDropBefore: (from: string, slug: string) => void;
}) {
  const isDragging = draggingSlug === group.categorySlug;
  const isOver =
    dropTarget?.kind === "before" &&
    dropTarget.slug === group.categorySlug &&
    draggingSlug &&
    draggingSlug !== group.categorySlug;

  return (
    <section
      className={[
        "article-section",
        group.draggable ? "article-section-sortable" : "",
        isDragging ? "is-dragging" : "",
        isOver ? "is-drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(event) => {
        if (!group.draggable || !draggingSlug || !group.categorySlug) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOverBefore(group.categorySlug);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!group.categorySlug) return;
        const from = event.dataTransfer.getData("text/plain") || draggingSlug;
        if (!from || from === group.categorySlug) {
          onDragEnd();
          return;
        }
        onDropBefore(from, group.categorySlug);
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
        style={{ ["--i" as string]: stagger }}
        draggable={group.draggable}
        onDragStart={(event) => {
          if (!group.categorySlug) return;
          onDragStart(group.categorySlug);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", group.categorySlug);
        }}
        onDragEnd={onDragEnd}
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
            group.title ? `Add article in ${group.title}` : "Add article"
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
          {group.items.map((article, index) => {
            const edited = hasUnpublishedChanges(article);
            const releaseDate =
              article.status === "published"
                ? formatReleaseDate(article.publishedAt)
                : null;
            return (
              <li
                key={article.id}
                className="article-list-item"
                style={{ ["--i" as string]: stagger + index + 1 }}
              >
                <Link
                  href={`/articles/${article.slug}`}
                  className="article-link"
                  prefetch
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <span className="article-link-title">{article.title}</span>
                  <span className="article-link-meta">
                    {article.status === "draft" ? (
                      <span className="draft-tag">draft</span>
                    ) : null}
                    {edited ? <span className="edited-tag">edited</span> : null}
                    {releaseDate ? (
                      <time
                        className="article-release-date"
                        dateTime={article.publishedAt ?? undefined}
                      >
                        {releaseDate}
                      </time>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
