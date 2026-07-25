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
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = useCallback(
    (nextStatus: ArticleStatus) => {
      if (!title.trim() || pending || uploading) return;
      if (content.includes("blob:")) {
        setError("Wait for image upload to finish, then save again.");
        return;
      }
      setError(null);
      setStatusNote(nextStatus === "published" ? "Publishing…" : "Saving…");
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
          setStatusNote(null);
          setError(
            (data && "error" in data && data.error) || "Failed to save article",
          );
          return;
        }

        const saved = data as Article;
        setStatusNote(nextStatus === "published" ? "Published" : "Saved");

        if (mode === "create" || saved.slug !== article?.slug) {
          router.replace(`/articles/${saved.slug}/edit`);
        }

        if (nextStatus === "published") {
          router.push(`/articles/${saved.slug}?v=${Date.now()}`);
          router.refresh();
        }
      });
    },
    [article, content, mode, pending, router, title, uploading],
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
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          className="editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
        />

        <IconButton
          label="Release"
          disabled={pending || uploading || !title.trim()}
          onClick={() => save("published")}
        >
          <CheckIcon className="h-5 w-5" />
        </IconButton>
      </header>

      <motion.div
        className="editor-body"
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {uploading ? (
          <p className="editor-status">Uploading image…</p>
        ) : statusNote ? (
          <p className="editor-status">{statusNote}</p>
        ) : null}
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onUploadingChange={setUploading}
        />
        {error ? <p className="form-error">{error}</p> : null}
      </motion.div>
    </div>
  );
}
