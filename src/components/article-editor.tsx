"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { MarkdownEditor } from "./editor/markdown-editor";
import { IconButton } from "./icon-button";
import { CheckIcon, ChevronLeftIcon } from "./icons";
import type { Article, ArticleStatus } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  article?: Article;
  backHref?: string;
};

export function ArticleEditor({ mode, article, backHref = "/" }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = useCallback(
    (nextStatus: ArticleStatus) => {
      if (!title.trim() || pending) return;
      setError(null);
      startTransition(async () => {
        const payload = {
          title,
          content,
          status: nextStatus,
        };

        const res = await fetch(
          mode === "create" ? "/api/articles" : `/api/articles/${article!.slug}`,
          {
            method: mode === "create" ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        const data = (await res.json().catch(() => null)) as
          | (Article & { error?: undefined })
          | { error?: string }
          | null;

        if (!res.ok || !data || typeof (data as Article).slug !== "string") {
          setError(
            (data && "error" in data && data.error) || "Failed to save article",
          );
          return;
        }

        const saved = data as Article;

        if (mode === "create" || saved.slug !== article?.slug) {
          router.replace(`/articles/${saved.slug}/edit`);
        }

        if (nextStatus === "published") {
          router.push(`/articles/${saved.slug}`);
          router.refresh();
        }
      });
    },
    [article, content, mode, pending, router, title],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save("draft");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return (
    <div className="editor-shell">
      <header className="editor-bar">
        <IconButton label="Back" onClick={() => router.push(backHref)}>
          <ChevronLeftIcon className="h-5 w-5" />
        </IconButton>

        <motion.input
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
        />

        <IconButton
          label="Release"
          disabled={pending || !title.trim()}
          onClick={() => save("published")}
        >
          <CheckIcon className="h-5 w-5" />
        </IconButton>
      </header>

      <motion.div
        className="editor-body"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <MarkdownEditor value={content} onChange={setContent} />
        {error ? <p className="form-error">{error}</p> : null}
      </motion.div>
    </div>
  );
}
