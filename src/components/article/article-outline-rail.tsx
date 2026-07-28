"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { extractMarkdownOutline } from "@/lib/markdown-headings";

type Props = {
  content: string;
};

/**
 * ChatGPT-style side outline rail for the read page.
 * Portaled to `document.body` so it is not trapped by `.page-fade`’s
 * transform (which would make `position: fixed` relative to the article).
 * Collapsed: flat marks. Hover/pin expands titles in the right margin.
 */
export function ArticleOutlineRail({ content }: Props) {
  const headings = useMemo(
    () => extractMarkdownOutline(content),
    [content],
  );
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [layout, setLayout] = useState({ right: 16, maxWidth: 180 });
  const listRef = useRef<HTMLOListElement>(null);
  const expanded = hovered || pinned;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (headings.length < 2) {
      setVisible(false);
      return;
    }

    const topOutline = document.querySelector(".article-outline");

    const updateActive = () => {
      // Compare viewport positions — offsetTop is relative to offsetParent and
      // was always “above” scrollY, so the last heading stayed active forever.
      const marker = 108;
      let current: string | null = null;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= marker) {
          current = heading.id;
        }
      }
      setActiveId(current ?? headings[0]?.id ?? null);
    };

    const updateVisibility = () => {
      if (!topOutline) {
        setVisible(window.scrollY > 120);
        return;
      }
      const rect = topOutline.getBoundingClientRect();
      setVisible(rect.bottom < 72);
    };

    /** Place the rail in the empty strip to the right of the article column. */
    const updateLayout = () => {
      const column =
        document.querySelector(".read-body") ||
        document.querySelector(".prose-blog");
      if (!(column instanceof HTMLElement)) return;
      const rect = column.getBoundingClientRect();
      const gutter = window.innerWidth - rect.right;
      if (gutter < 72) {
        setLayout({ right: 14, maxWidth: 0 });
        return;
      }
      setLayout({
        right: 14,
        maxWidth: Math.min(224, gutter - 24),
      });
    };

    const onScroll = () => {
      updateActive();
      updateVisibility();
      updateLayout();
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  useEffect(() => {
    if (!expanded && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [expanded]);

  if (!mounted || headings.length < 2 || layout.maxWidth < 72) return null;

  return createPortal(
    <aside
      className={`outline-rail${visible ? " is-visible" : ""}${
        expanded ? " is-expanded" : ""
      }${pinned ? " is-pinned" : ""}`}
      style={{
        right: layout.right,
        ["--outline-rail-max-width" as string]: `${layout.maxWidth}px`,
      }}
      aria-label="Reading outline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={`outline-rail-pin${pinned ? " is-on" : ""}`}
        aria-pressed={pinned}
        aria-label={pinned ? "Unpin outline" : "Pin outline open"}
        title={pinned ? "Unpin" : "Pin"}
        onClick={() => setPinned((value) => !value)}
      >
        <PinIcon />
      </button>

      <ol
        ref={listRef}
        className="outline-rail-list"
        data-mode={expanded ? "text" : "marks"}
      >
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li
              key={`${heading.id}-${heading.level}`}
              className={`outline-rail-item is-h${heading.level}${
                active ? " is-active" : ""
              }`}
            >
              <a
                href={`#${heading.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  const el = document.getElementById(heading.id);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveId(heading.id);
                  history.replaceState(null, "", `#${heading.id}`);
                }}
              >
                <span className="outline-rail-mark" aria-hidden="true" />
                <span className="outline-rail-label">{heading.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </aside>,
    document.body,
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M8 1.5v6.5" strokeLinecap="round" />
      <path d="M4.5 3.5h7l-1 4.5H5.5L4.5 3.5Z" strokeLinejoin="round" />
      <path d="M8 8v6" strokeLinecap="round" />
    </svg>
  );
}
