"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "../chrome/icons";
import {
  isNoopCategoryDrop,
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

/** Left / right half of a column → share that column's row. */
function inlineTargetFromPointer(
  clientX: number,
  el: HTMLElement,
  slug: string,
): CategoryDropTarget {
  const rect = el.getBoundingClientRect();
  if (clientX - rect.left < rect.width / 2) {
    return { mode: "inline-before", anchor: slug };
  }
  return { mode: "inline-after", anchor: slug };
}

function sameTarget(a: CategoryDropTarget | null, b: CategoryDropTarget) {
  if (!a || a.mode !== b.mode) return false;
  return a.anchor === b.anchor;
}

type DragSession = {
  slug: string | null;
  target: CategoryDropTarget | null;
  committed: boolean;
};

/**
 * Admin homepage columns.
 *
 * Vertical (own row): dedicated row-gap hit targets — not the CSS gap void,
 * which cannot receive HTML5 drop events (the usual “indicator but no move”
 * failure for top/bottom).
 * Horizontal: left / right half of a column.
 *
 * Drop commits the last armed target (refs), including on dragend when the
 * pointer releases on a non-element gap — so the shown indicator always wins.
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
  const sessionRef = useRef<DragSession>({
    slug: null,
    target: null,
    committed: false,
  });
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

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
    const previous = rowsRef.current;
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

  function armTarget(target: CategoryDropTarget) {
    const slug = sessionRef.current.slug;
    const currentRows = rowsRef.current;
    if (!slug || isNoopCategoryDrop(currentRows, slug, target)) {
      sessionRef.current.target = null;
      setDropTarget((current) => (current === null ? current : null));
      return;
    }
    sessionRef.current.target = target;
    setDropTarget((current) =>
      sameTarget(current, target) ? current : target,
    );
  }

  function commitSession() {
    const { slug, target, committed } = sessionRef.current;
    if (committed || !slug || !target) return;
    sessionRef.current.committed = true;
    const currentRows = rowsRef.current;
    const next = placeCategory(currentRows, slug, target);
    if (JSON.stringify(next) !== JSON.stringify(currentRows)) {
      void persistRows(next);
    }
  }

  function beginDrag(slug: string) {
    sessionRef.current = { slug, target: null, committed: false };
    setDraggingSlug(slug);
    setDropTarget(null);
  }

  function endDrag() {
    // If the browser skipped `drop` (release over a void), still honor the
    // last indicator the user saw.
    commitSession();
    sessionRef.current = { slug: null, target: null, committed: false };
    setDraggingSlug(null);
    setDropTarget(null);
  }

  function acceptDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    commitSession();
    sessionRef.current = { slug: null, target: null, committed: true };
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

      <div className="article-rows article-rows-admin">
        {articleRows.map((row) => {
          const anchor =
            row.groups.find((g) => g.categorySlug)?.categorySlug ?? null;

          return (
            <div key={row.key} className="article-row-block">
              <RowGap
                active={
                  dropTarget?.mode === "solo-before" &&
                  dropTarget.anchor === anchor &&
                  anchor !== null
                }
                disabled={!draggingSlug}
                onArm={() => {
                  if (!anchor) return;
                  armTarget({ mode: "solo-before", anchor });
                }}
                onDrop={acceptDrop}
              />

              <div
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
                    onDragStart={beginDrag}
                    onDragEnd={endDrag}
                    onArmInline={(el, clientX) => {
                      if (!group.categorySlug) return;
                      armTarget(
                        inlineTargetFromPointer(
                          clientX,
                          el,
                          group.categorySlug,
                        ),
                      );
                    }}
                    onDrop={acceptDrop}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <RowGap
          active={
            dropTarget?.mode === "solo-before" && dropTarget.anchor === null
          }
          disabled={!draggingSlug}
          onArm={() => armTarget({ mode: "solo-before", anchor: null })}
          onDrop={acceptDrop}
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
              onArmInline={() => {}}
              onDrop={() => {}}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowGap({
  active,
  disabled,
  onArm,
  onDrop,
}: {
  active: boolean;
  disabled: boolean;
  onArm: () => void;
  onDrop: (event: React.DragEvent) => void;
}) {
  return (
    <div
      className={`article-row-gap${active ? " is-active" : ""}`}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        onArm();
      }}
      onDrop={onDrop}
    />
  );
}

function CategorySection({
  group,
  stagger,
  draggingSlug,
  dropTarget,
  onDragStart,
  onDragEnd,
  onArmInline,
  onDrop,
}: {
  group: ArticleGroup;
  stagger: number;
  draggingSlug: string | null;
  dropTarget: CategoryDropTarget | null;
  onDragStart: (slug: string) => void;
  onDragEnd: () => void;
  onArmInline: (el: HTMLElement, clientX: number) => void;
  onDrop: (event: React.DragEvent) => void;
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
        onArmInline(event.currentTarget, event.clientX);
      }}
      onDrop={onDrop}
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
