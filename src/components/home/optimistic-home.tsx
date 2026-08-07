"use client";

import { useEffect, useState } from "react";
import { BrandTitle } from "./brand-title";
import { Markdown } from "../markdown";

type Optimistic = { title: string; content: string; at: number };

function readOptimistic(): Optimistic | null {
  try {
    const raw = sessionStorage.getItem("optimistic-home");
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      title?: string;
      content?: string;
      at?: number;
    };
    if (!data.at || Date.now() - data.at > 60_000) {
      sessionStorage.removeItem("optimistic-home");
      return null;
    }
    return {
      title: typeof data.title === "string" ? data.title : "",
      content: typeof data.content === "string" ? data.content : "",
      at: data.at,
    };
  } catch {
    return null;
  }
}

export function OptimisticHome({
  title,
  content,
  editHref,
}: {
  title: string;
  content: string;
  editHref?: string;
}) {
  const [pending, setPending] = useState<Optimistic | null>(() =>
    readOptimistic(),
  );

  // The server caught up — drop the optimistic copy for good.
  if (pending && title === pending.title && content === pending.content) {
    setPending(null);
  }

  // Keep the just-edited body until the server catches up.
  const t = pending ? pending.title : title;
  const c = pending ? pending.content : content;

  useEffect(() => {
    if (pending) return;
    try {
      sessionStorage.removeItem("optimistic-home");
    } catch {
      // ignore
    }
  }, [pending]);

  return (
    <>
      <BrandTitle title={t} editHref={editHref} />
      <Markdown content={c} className="prose-blog lead-prose" />
    </>
  );
}
