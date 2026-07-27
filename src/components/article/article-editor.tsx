"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { MarkdownEditorLazy } from "../editor/markdown-editor-lazy";
import { CheckIcon, ChevronLeftIcon, SaveIcon } from "../chrome/icons";
import { CategoryPicker } from "./category-picker";
import { EditorSaveMeta } from "./editor-save-meta";
import { formatEditStamp } from "@/lib/format-time";
import type { Article, ArticleStatus, Category } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  article?: Article;
  categories?: Category[];
  /** Preselect from `/articles/new?category=` — placement set on first create. */
  initialCategorySlug?: string | null;
  backHref?: string;
};

const AUTOSAVE_MS = 2500;

export function ArticleEditor({
  article,
  categories: initialCategories = [],
  initialCategorySlug = null,
  backHref = "/",
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [slug, setSlug] = useState(article?.slug);
  const [articleStatus, setArticleStatus] = useState<ArticleStatus>(
    article?.status ?? "draft",
  );
  // Official placement — Release updates it; first create also stamps it so
  // drafts from a column's + land under that column.
  const [categorySlug, setCategorySlug] = useState<string | null>(
    article?.categorySlug ?? initialCategorySlug,
  );
  const [categories, setCategories] = useState(initialCategories);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(
    article?.updatedAt ? Date.parse(article.updatedAt) : null,
  );
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [dirty, setDirty] = useState(false);

  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const slugRef = useRef(slug);
  const statusRef = useRef(articleStatus);
  const categorySlugRef = useRef(categorySlug);
  const dirtyRef = useRef(dirty);
  const uploadingRef = useRef(uploading);
  const pendingRef = useRef(pending);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);
  useEffect(() => {
    statusRef.current = articleStatus;
  }, [articleStatus]);
  useEffect(() => {
    categorySlugRef.current = categorySlug;
  }, [categorySlug]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    router.prefetch(backHref);
    if (slug) router.prefetch(`/articles/${slug}`);
  }, [backHref, router, slug]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const persist = useCallback(
    (intent: "save" | "release", opts?: { silent?: boolean }) => {
      const nextTitle = titleRef.current;
      const nextContent = contentRef.current;
      if (!nextTitle.trim()) return;
      if (saveInFlightRef.current || pendingRef.current || uploadingRef.current) {
        return;
      }
      if (nextContent.includes("blob:")) {
        if (!opts?.silent) {
          setError("Wait for image upload to finish, then save again.");
        }
        return;
      }

      const nextStatus: ArticleStatus =
        intent === "release"
          ? "published"
          : statusRef.current === "published"
            ? "published"
            : "draft";

      setError(null);
      saveInFlightRef.current = true;

      startTransition(async () => {
        try {
          const currentSlug = slugRef.current;
          const body: Record<string, unknown> = {
            title: nextTitle,
            content: nextContent,
            status: nextStatus,
          };
          // Stamp placement on first create (so column + drafts show up) and
          // on Release. Later draft saves leave official placement alone.
          if (!currentSlug || intent === "release") {
            body.categorySlug = categorySlugRef.current;
          }

          const res = await fetch(
            currentSlug ? `/api/articles/${currentSlug}` : "/api/articles",
            {
              method: currentSlug ? "PUT" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );

          const data = (await res.json().catch(() => null)) as
            | (Article & { error?: undefined })
            | { error?: string }
            | null;

          if (!res.ok || !data || typeof (data as Article).slug !== "string") {
            if (!opts?.silent) {
              setError(
                (data && "error" in data && data.error) ||
                  "Failed to save article",
              );
            }
            return;
          }

          const saved = data as Article;
          setSlug(saved.slug);
          setArticleStatus(saved.status);
          if (!currentSlug || intent === "release") {
            setCategorySlug(saved.categorySlug ?? null);
          }
          setLastSavedAt(Date.parse(saved.updatedAt) || Date.now());
          setNowTick(Date.now());
          setDirty(false);
          dirtyRef.current = false;

          if (intent === "release") {
            try {
              sessionStorage.setItem(
                `optimistic-article:${saved.slug}`,
                JSON.stringify({
                  title: nextTitle,
                  content: nextContent,
                  at: Date.now(),
                }),
              );
            } catch {
              // ignore
            }
            router.push(`/articles/${saved.slug}?v=${Date.now()}`);
            router.refresh();
            return;
          }

          if (!currentSlug || saved.slug !== currentSlug) {
            router.replace(`/articles/${saved.slug}/edit`);
          }
        } finally {
          saveInFlightRef.current = false;
        }
      });
    },
    [router],
  );

  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const saveExplicit = useCallback(() => {
    persist("save");
  }, [persist]);

  const release = useCallback(() => {
    persist("release");
  }, [persist]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveExplicit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveExplicit]);

  // Lightweight cloud autosave — only when dirty draft/published content settles.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      if (!dirtyRef.current) return;
      if (!titleRef.current.trim()) return;
      if (uploadingRef.current || pendingRef.current || saveInFlightRef.current) {
        return;
      }
      if (contentRef.current.includes("blob:")) return;
      persistRef.current("save", { silent: true });
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, title, content]);

  const editStamp = formatEditStamp(lastSavedAt, nowTick);
  const busy = pending || uploading;

  return (
    <div className="editor-shell">
      <header className="editor-bar">
        <div className="editor-bar-start">
          <Link
            href={backHref}
            prefetch
            aria-label="Back"
            title="Back"
            className="icon-btn icon-btn-motion"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <CategoryPicker
            categories={categories}
            value={categorySlug}
            onChange={setCategorySlug}
            onCategoriesChange={setCategories}
          />
        </div>

        <input
          className="editor-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Title"
          aria-label="Title"
        />

        <div className="editor-bar-actions">
          <EditorSaveMeta stamp={editStamp} />
          <button
            type="button"
            aria-label="Save"
            title="Save"
            disabled={busy || !title.trim()}
            onClick={saveExplicit}
            className="icon-btn icon-btn-motion"
          >
            <SaveIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Release"
            title="Release"
            disabled={busy || !title.trim()}
            onClick={release}
            className="icon-btn icon-btn-motion"
          >
            <CheckIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="editor-body page-fade">
        {uploading ? (
          <p className="editor-status">Uploading image…</p>
        ) : null}
        <MarkdownEditorLazy
          value={content}
          onChange={(value) => {
            setContent(value);
            setDirty(true);
          }}
          onUploadingChange={setUploading}
        />
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}
