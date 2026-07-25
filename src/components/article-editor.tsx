"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { MarkdownEditorLazy } from "./editor/markdown-editor-lazy";
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

  // Warm the back / read route while editing.
  useEffect(() => {
    router.prefetch(backHref);
    if (article?.slug) {
      router.prefetch(`/articles/${article.slug}`);
    }
  }, [article?.slug, backHref, router]);

  const save = useCallback(
    (nextStatus: ArticleStatus) => {
      if (!title.trim() || pending || uploading) return;
      if (content.includes("blob:")) {
        setError("Wait for image upload to finish, then save again.");
        return;
      }
      setError(null);
      setStatusNote(nextStatus === "published" ? "Publishing…" : "Saving…");

      const knownSlug = article?.slug;
      const canOptimisticNav =
        nextStatus === "published" && mode === "edit" && Boolean(knownSlug);

      // Instant publish feel: navigate first, persist in background.
      if (canOptimisticNav && knownSlug) {
        try {
          sessionStorage.setItem(
            `optimistic-article:${knownSlug}`,
            JSON.stringify({
              title,
              content,
              at: Date.now(),
            }),
          );
        } catch {
          // ignore quota / private mode
        }
        router.push(`/articles/${knownSlug}?v=${Date.now()}`);
      }

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
          if (canOptimisticNav && knownSlug) {
            try {
              sessionStorage.removeItem(`optimistic-article:${knownSlug}`);
            } catch {
              // ignore
            }
            router.replace(`/articles/${knownSlug}/edit`);
          }
          return;
        }

        const saved = data as Article;
        setStatusNote(nextStatus === "published" ? "Published" : "Saved");

        if (nextStatus === "published") {
          if (!canOptimisticNav) {
            router.push(`/articles/${saved.slug}?v=${Date.now()}`);
          } else if (saved.slug !== knownSlug) {
            router.replace(`/articles/${saved.slug}?v=${Date.now()}`);
          } else {
            router.refresh();
          }
          return;
        }

        if (mode === "create" || saved.slug !== article?.slug) {
          router.replace(`/articles/${saved.slug}/edit`);
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
        <Link
          href={backHref}
          prefetch
          aria-label="Back"
          title="Back"
          className="icon-btn icon-btn-motion"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>

        <input
          className="editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
        />

        <button
          type="button"
          aria-label="Release"
          title="Release"
          disabled={pending || uploading || !title.trim()}
          onClick={() => save("published")}
          className="icon-btn icon-btn-motion"
        >
          <CheckIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="editor-body page-fade">
        {uploading ? (
          <p className="editor-status">Uploading image…</p>
        ) : statusNote ? (
          <p className="editor-status">{statusNote}</p>
        ) : null}
        <MarkdownEditorLazy
          value={content}
          onChange={setContent}
          onUploadingChange={setUploading}
        />
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}
