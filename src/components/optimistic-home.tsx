"use client";

import { useEffect, useState } from "react";
import { BrandTitle } from "./brand-title";
import { Markdown } from "./markdown";

export function OptimisticHome({
  title,
  content,
  editHref,
}: {
  title: string;
  content: string;
  editHref?: string;
}) {
  const [t, setT] = useState(title);
  const [c, setC] = useState(content);

  useEffect(() => {
    setT(title);
    setC(content);
  }, [title, content]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("optimistic-home");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        title?: string;
        content?: string;
        at?: number;
      };
      if (!data.at || Date.now() - data.at > 30_000) {
        sessionStorage.removeItem("optimistic-home");
        return;
      }
      if (typeof data.title === "string") setT(data.title);
      if (typeof data.content === "string") setC(data.content);
      sessionStorage.removeItem("optimistic-home");
    } catch {
      // ignore
    }
  }, []);

  return (
    <>
      <BrandTitle title={t} editHref={editHref} />
      <Markdown content={c} className="prose-blog lead-prose" />
    </>
  );
}
