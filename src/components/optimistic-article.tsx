"use client";

import { useEffect, useState } from "react";
import { Markdown } from "./markdown";
import { ReadTitle } from "./read-title";

type Optimistic = { title: string; content: string };

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
    if (!data.at || Date.now() - data.at > 30_000) {
      sessionStorage.removeItem(`optimistic-article:${slug}`);
      return null;
    }
    const value: Optimistic = {
      title: typeof data.title === "string" ? data.title : "",
      content: typeof data.content === "string" ? data.content : "",
    };
    memory.set(slug, value);
    sessionStorage.removeItem(`optimistic-article:${slug}`);
    return value;
  } catch {
    return null;
  }
}

export function OptimisticReadTitle({
  slug,
  title,
  editHref,
}: {
  slug: string;
  title: string;
  editHref?: string;
}) {
  const [value, setValue] = useState(title);

  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    const data = peekOptimisticArticle(slug);
    if (data?.title) setValue(data.title);
  }, [slug]);

  return <ReadTitle title={value} editHref={editHref} />;
}

export function OptimisticArticleBody({
  slug,
  content,
}: {
  slug: string;
  content: string;
}) {
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);

  useEffect(() => {
    const data = peekOptimisticArticle(slug);
    if (data?.content) setValue(data.content);
  }, [slug]);

  return <Markdown content={value} />;
}
