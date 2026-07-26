"use client";

import { useEffect, useState } from "react";
import { BrandTitle } from "./brand-title";
import { Markdown } from "./markdown";

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
  const [t, setT] = useState(() => pending?.title ?? title);
  const [c, setC] = useState(() => pending?.content ?? content);

  useEffect(() => {
    if (pending) {
      // Keep the just-edited body until the server catches up.
      if (title === pending.title && content === pending.content) {
        try {
          sessionStorage.removeItem("optimistic-home");
        } catch {
          // ignore
        }
        setPending(null);
        setT(title);
        setC(content);
      }
      return;
    }
    setT(title);
    setC(content);
  }, [title, content, pending]);

  return (
    <>
      <BrandTitle title={t} editHref={editHref} />
      <Markdown content={c} className="prose-blog lead-prose" />
    </>
  );
}
