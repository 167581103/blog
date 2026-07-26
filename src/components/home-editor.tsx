"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MarkdownEditorLazy } from "./editor/markdown-editor-lazy";
import { CheckIcon, ChevronLeftIcon } from "./icons";
import type { HomeContent } from "@/lib/types";

export function HomeEditor({ home }: { home: HomeContent }) {
  const router = useRouter();
  const [title, setTitle] = useState(home.title);
  const [content, setContent] = useState(home.content);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  function save() {
    setError(null);
    setStatusNote("Saving…");

    startTransition(async () => {
      const res = await fetch("/api/home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatusNote(null);
        setError(data?.error || "Failed to save");
        return;
      }

      try {
        sessionStorage.setItem(
          "optimistic-home",
          JSON.stringify({ title, content, at: Date.now() }),
        );
      } catch {
        // ignore
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="editor-shell">
      <header className="editor-bar">
        <Link
          href="/"
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
          aria-label="Home title"
        />
        <button
          type="button"
          aria-label="Save"
          title="Save"
          disabled={pending}
          onClick={save}
          className="icon-btn icon-btn-motion"
        >
          <CheckIcon className="h-5 w-5" />
        </button>
      </header>
      <div className="editor-body page-fade">
        {statusNote ? <p className="editor-status">{statusNote}</p> : null}
        <MarkdownEditorLazy value={content} onChange={setContent} />
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}
