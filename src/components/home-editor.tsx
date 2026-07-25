"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { MarkdownEditor } from "./editor/markdown-editor";
import { IconButton } from "./icon-button";
import { CheckIcon, ChevronLeftIcon } from "./icons";
import type { HomeContent } from "@/lib/types";

export function HomeEditor({ home }: { home: HomeContent }) {
  const router = useRouter();
  const [title, setTitle] = useState(home.title);
  const [content, setContent] = useState(home.content);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
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
        setError(data?.error || "Failed to save");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="editor-shell">
      <header className="editor-bar">
        <IconButton label="Back" onClick={() => router.push("/")}>
          <ChevronLeftIcon className="h-5 w-5" />
        </IconButton>
        <motion.input
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Home title"
        />
        <IconButton label="Save" disabled={pending} onClick={save}>
          <CheckIcon className="h-5 w-5" />
        </IconButton>
      </header>
      <motion.div
        className="editor-body"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <MarkdownEditor value={content} onChange={setContent} />
        {error ? <p className="form-error">{error}</p> : null}
      </motion.div>
    </div>
  );
}
