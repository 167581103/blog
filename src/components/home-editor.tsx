"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MarkdownEditorLazy } from "./editor/markdown-editor-lazy";
import { CheckIcon, ChevronLeftIcon } from "./icons";
import type { HomeContent, ResumeInfo } from "@/lib/types";

export function HomeEditor({
  home,
  resume: initialResume,
}: {
  home: HomeContent;
  resume: ResumeInfo;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(home.title);
  const [content, setContent] = useState(home.content);
  const [resume, setResume] = useState(initialResume);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resumePending, setResumePending] = useState(false);

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

  async function onResumeSelected(file: File | null) {
    if (!file) return;
    setError(null);
    setResumePending(true);
    setStatusNote("Uploading resume…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | (ResumeInfo & { error?: string })
        | { error?: string }
        | null;
      if (!res.ok || !data || !("exists" in data)) {
        setError(
          (data && "error" in data && data.error) || "Failed to upload resume",
        );
        setStatusNote(null);
        return;
      }
      setResume(data);
      setStatusNote("Resume updated — link: /resume.pdf");
    } finally {
      setResumePending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeResume() {
    if (!resume.exists) return;
    setError(null);
    setResumePending(true);
    setStatusNote("Removing resume…");
    try {
      const res = await fetch("/api/resume", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || "Failed to remove resume");
        setStatusNote(null);
        return;
      }
      setResume({ exists: false, updatedAt: null, publicPath: "/resume.pdf" });
      setStatusNote("Resume removed");
    } finally {
      setResumePending(false);
    }
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
          disabled={pending || resumePending}
          onClick={save}
          className="icon-btn icon-btn-motion"
        >
          <CheckIcon className="h-5 w-5" />
        </button>
      </header>
      <div className="editor-body page-fade">
        {statusNote ? <p className="editor-status">{statusNote}</p> : null}

        <section className="site-file-panel" aria-label="Resume">
          <div className="site-file-panel-copy">
            <p className="site-file-panel-title">Resume</p>
            <p className="site-file-panel-hint">
              Public URL:{" "}
              <code>/resume.pdf</code>
              {resume.exists ? " (live)" : " (upload to enable)"}
            </p>
            <p className="site-file-panel-hint">
              On the homepage, link it as{" "}
              <code>[Resume](/resume.pdf)</code>
            </p>
          </div>
          <div className="site-file-panel-actions">
            {resume.exists ? (
              <a
                className="ghost-btn"
                href="/resume.pdf"
                target="_blank"
                rel="noreferrer"
              >
                View
              </a>
            ) : null}
            <button
              type="button"
              className="ghost-btn"
              disabled={resumePending}
              onClick={() => fileRef.current?.click()}
            >
              {resume.exists ? "Replace PDF" : "Upload PDF"}
            </button>
            {resume.exists ? (
              <button
                type="button"
                className="ghost-btn"
                disabled={resumePending}
                onClick={() => void removeResume()}
              >
                Remove
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) =>
                void onResumeSelected(e.target.files?.[0] ?? null)
              }
            />
          </div>
        </section>

        <MarkdownEditorLazy value={content} onChange={setContent} />
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}
