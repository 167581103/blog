"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "../chrome/icons";
import {
  placeCategory,
  type CategoryDropTarget,
  type CategoryLayout,
} from "@/lib/category-layout";
import { formatReleaseDate } from "@/lib/format-time";
import { hasUnpublishedChanges, type Article } from "@/lib/types";
import { buildArticleRows, type ArticleGroup } from "./article-groups";

type Props = {
  articles: Article[];
  layout: CategoryLayout;
};

/**
 * Resolve which edge of a column the pointer is on.
 * Top band → park as its own row above this column's row.
 * Left / right → share this column's row (horizontal).
 */
function dropTargetFromPointer(
  clientX: number,
  clientY: number,
  el: HTMLElement,
  slug: string,
): CategoryDropTarget {
  const rect = el.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const topBand = Math.min(32, Math.max(16, rect.height * 0.25));

  if (y < topBand) {
    return { mode: "solo-before", anchor: slug };
  }
  if (x < rect.width / 2) {
    return { mode: "inline-before", anchor: slug };
  }
  return { mode: "inline-after", anchor: slug };
}

function sameTarget(a: CategoryDropTarget | null, b: CategoryDropTarget) {
  if (!a || a.mode !== b.mode) return false;
  return a.anchor === b.anchor;
}

/**
 * Admin homepage columns. Drag a header to move:
 * - top edge of a column → own full-width row above that row
 * - left / right half → place horizontally in that row (max 3)
 * - bottom pad → own row at the end
 *
 * DOM stays stable while dragging (no slot mount/unmount), so every
 * column — including the last — can start a drag. Only the active
 * edge paints a dark indicator; no gray filler boxes.
 */
export function AdminArticleSections({ articles, layout }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(layout.rows);
  const [categories, setCategories] = useState(layout.categories);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<CategoryDropTarget | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRows(layout.rows);
    setCategories(layout.categories);
  }, [layout]);

  const currentLayout: CategoryLayout = { categories, rows };
  const { rows: articleRows, loose } = buildArticleRows(
    articles,
    currentLayout,
    { isAdmin: true },
  );

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

  function commitDrop(from: string, target: CategoryDropTarget) {
    const next = placeCategory(rows, from, target);
    if (JSON.stringify(next) !== JSON.stringify(rows)) {
      void persistRows(next);
    }
  }

  function clearDrag() {
    setDraggingSlug(null);
    setDropTarget(null);
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
        {articleRows.map((row) => (
          <div
            key={row.key}
            className="article-row"
            style={{ ["--cols" as string]: row.groups.length }}
          >
            {row.groups.map((group) => (
              <CategorySection
                key={group.key}
                group={group}
                stagger={stagger++}
                draggingSlug={draggingSlug}
                dropTarget={dropTarget}
                onDragStart={(slug) => {
                  setDraggingSlug(slug);
                  setDropTarget(null);
                }}
                onDragEnd={clearDrag}
                onDropTarget={(target) => {
                  setDropTarget((current) =>
                    sameTarget(current, target) ? current : target,
                  );
                }}
                onDrop={(from, target) => {
                  clearDrag();
                  commitDrop(from, target);
                }}
              />
            ))}
          </div>
        ))}

        <div
          className={`article-row-end${
            dropTarget?.mode === "solo-before" && dropTarget.anchor === null
              ? " is-active"
              : ""
          }`}
          onDragOver={(event) => {
            if (!draggingSlug) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const target: CategoryDropTarget = {
              mode: "solo-before",
              anchor: null,
            };
            setDropTarget((current) =>
              sameTarget(current, target) ? current : target,
            );
          }}
          onDrop={(event) => {
            event.preventDefault();
            const from =
              event.dataTransfer.getData("text/plain") || draggingSlug;
            clearDrag();
            if (!from) return;
            commitDrop(from, { mode: "solo-before", anchor: null });
          }}
        />
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
              onDropTarget={() => {}}
              onDrop={() => {}}
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
  onDropTarget,
  onDrop,
}: {
  group: ArticleGroup;
  stagger: number;
  draggingSlug: string | null;
  dropTarget: CategoryDropTarget | null;
  onDragStart: (slug: string) => void;
  onDragEnd: () => void;
  onDropTarget: (target: CategoryDropTarget) => void;
  onDrop: (from: string, target: CategoryDropTarget) => void;
}) {
  const slug = group.categorySlug;
  const isDragging = Boolean(slug && draggingSlug === slug);
  const active =
    draggingSlug && slug && draggingSlug !== slug && dropTarget?.anchor === slug
      ? dropTarget.mode
      : null;

  return (
    <section
      className={[
        "article-section",
        group.draggable ? "article-section-sortable" : "",
        isDragging ? "is-dragging" : "",
        active === "solo-before" ? "is-drop-solo" : "",
        active === "inline-before" ? "is-drop-before" : "",
        active === "inline-after" ? "is-drop-after" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(event) => {
        if (!group.draggable || !draggingSlug || !slug) return;
        if (draggingSlug === slug) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDropTarget(
          dropTargetFromPointer(
            event.clientX,
            event.clientY,
            event.currentTarget,
            slug,
          ),
        );
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!slug || !draggingSlug || draggingSlug === slug) {
          onDragEnd();
          return;
        }
        const from = event.dataTransfer.getData("text/plain") || draggingSlug;
        const target = dropTargetFromPointer(
          event.clientX,
          event.clientY,
          event.currentTarget,
          slug,
        );
        onDrop(from, target);
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
        title={group.draggable ? "Drag to rearrange" : undefined}
        onDragStart={(event) => {
          if (!slug) return;
          // Required for HTML5 DnD in Firefox; also keeps drag image stable.
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", slug);
          onDragStart(slug);
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
            slug
              ? `/articles/new?category=${encodeURIComponent(slug)}`
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
