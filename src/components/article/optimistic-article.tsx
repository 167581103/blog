"use client";

import { useEffect, useState } from "react";
import { Markdown } from "../markdown";
import { ArticleOutline } from "./article-outline";
import { ArticleOutlineRail } from "./article-outline-rail";
import { ReadTitle } from "./read-title";

type Optimistic = { title: string; content: string; at: number };

const memory = new Map<string, Optimistic>();

function peekOptimisticArticle(slug: string): Optimistic | null {
  const hit = memory.get(slug);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(`optimistic-article:${slug}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      title?: string;
      content?: string;
      at?: number;
    };
    if (!data.at || Date.now() - data.at > 60_000) {
      sessionStorage.removeItem(`optimistic-article:${slug}`);
      return null;
    }
    const value: Optimistic = {
      title: typeof data.title === "string" ? data.title : "",
      content: typeof data.content === "string" ? data.content : "",
      at: data.at,
    };
    memory.set(slug, value);
    return value;
  } catch {
    return null;
  }
}

function clearOptimisticArticle(slug: string) {
  memory.delete(slug);
  try {
    sessionStorage.removeItem(`optimistic-article:${slug}`);
  } catch {
    // ignore
  }
}

function useOptimisticArticle(
  slug: string,
  title: string,
  content: string,
): { title: string; content: string } {
  // Callers key these components by slug, so a different article remounts
  // instead of needing the stored copy re-read here.
  const [pending, setPending] = useState<Optimistic | null>(() =>
    peekOptimisticArticle(slug),
  );

  // The server caught up — drop the optimistic copy for good.
  if (pending && title === pending.title && content === pending.content) {
    setPending(null);
  }

  useEffect(() => {
    if (pending) return;
    clearOptimisticArticle(slug);
  }, [pending, slug]);

  // Keep the just-edited copy until the server catches up.
  return pending
    ? { title: pending.title, content: pending.content }
    : { title, content };
}

export function OptimisticReadTitle({
  slug,
  title,
  content,
  editHref,
}: {
  slug: string;
  title: string;
  content: string;
  editHref?: string;
}) {
  const view = useOptimisticArticle(slug, title, content);
  return <ReadTitle title={view.title} editHref={editHref} />;
}

export function OptimisticArticleBody({
  slug,
  title,
  content,
}: {
  slug: string;
  title: string;
  content: string;
}) {
  const view = useOptimisticArticle(slug, title, content);
  return (
    <>
      <ArticleOutline content={view.content} linkable />
      <ArticleOutlineRail content={view.content} />
      <Markdown content={view.content} />
    </>
  );
}
