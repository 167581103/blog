"use client";

import { useEffect, useState } from "react";
import { Markdown } from "../markdown";
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
  const [pending, setPending] = useState<Optimistic | null>(() =>
    peekOptimisticArticle(slug),
  );
  const [view, setView] = useState(() => ({
    title: pending?.title || title,
    content: pending?.content || content,
  }));

  useEffect(() => {
    const next = peekOptimisticArticle(slug);
    setPending(next);
    if (next) {
      setView({ title: next.title, content: next.content });
    }
  }, [slug]);

  useEffect(() => {
    if (pending) {
      if (title === pending.title && content === pending.content) {
        clearOptimisticArticle(slug);
        setPending(null);
        setView({ title, content });
      }
      return;
    }
    setView({ title, content });
  }, [title, content, pending, slug]);

  return view;
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
  return <Markdown content={view.content} />;
}
