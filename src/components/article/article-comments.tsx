"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COMMENT_MAX_LENGTH } from "@/lib/db/constants";

export type CommentView = {
  id: string;
  articleSlug: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    login: string;
    name: string | null;
    image: string | null;
  };
};

type Viewer = {
  githubId: string;
  login: string;
  isAdmin: boolean;
} | null;

type Props = {
  slug: string;
  initialComments: CommentView[];
  dbReady: boolean;
  setupError?: string;
  viewer: Viewer;
  /** Signed in for writing, but session lacks githubId (needs re-login). */
  needsRelogin?: boolean;
};

export function ArticleComments({
  slug,
  initialComments,
  dbReady,
  setupError,
  viewer,
  needsRelogin = false,
}: Props) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loginHref = `/login?next=${encodeURIComponent(`/articles/${slug}`)}`;

  function submit() {
    setError(null);
    const text = body.trim();
    if (!text) {
      setError("Comment cannot be empty.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, body: text }),
      });
      const data = (await res.json()) as {
        comment?: CommentView;
        error?: string;
      };
      if (!res.ok || !data.comment) {
        setError(data.error || "Failed to post comment.");
        return;
      }
      setComments((prev) => [...prev, data.comment!]);
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || "Failed to delete comment.");
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    });
  }

  return (
    <section className="comments-wrap" aria-label="Comments">
      <h2 className="comments-heading">Comments</h2>

      {!dbReady ? (
        <p className="comments-pending">
          {setupError === "schema_missing" ? (
            <>
              Database is connected, but tables are missing. In Neon SQL Editor
              run <code>drizzle/init.sql</code>, or locally:{" "}
              <code>npm run db:push</code>.
            </>
          ) : (
            <>
              Comments need Neon. Connect it on Vercel, set{" "}
              <code>DATABASE_URL</code>, run <code>npm run db:push</code>, then
              redeploy.
            </>
          )}
        </p>
      ) : (
        <>
          {comments.length === 0 ? (
            <p className="comments-empty">No comments yet.</p>
          ) : (
            <ul className="comments-list">
              {comments.map((comment) => {
                const canDelete =
                  viewer &&
                  (viewer.isAdmin || viewer.githubId === comment.author.id);
                return (
                  <li key={comment.id} className="comment-item">
                    <div className="comment-meta">
                      <span className="comment-author">
                        {comment.author.name || comment.author.login}
                      </span>
                      <time dateTime={comment.createdAt}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </time>
                      {canDelete ? (
                        <button
                          type="button"
                          className="comment-delete"
                          disabled={pending}
                          onClick={() => remove(comment.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <p className="comment-body">{comment.body}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {viewer ? (
            <div className="comment-compose">
              <p className="comment-signed-in">
                Signed in as <strong>{viewer.login}</strong>
              </p>
              <textarea
                className="comment-input"
                value={body}
                maxLength={COMMENT_MAX_LENGTH}
                rows={4}
                placeholder="Write a comment…"
                disabled={pending}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="comment-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={pending || !body.trim()}
                  onClick={submit}
                >
                  {pending ? "Posting…" : "Post comment"}
                </button>
                <span className="comment-count">
                  {body.trim().length}/{COMMENT_MAX_LENGTH}
                </span>
              </div>
            </div>
          ) : needsRelogin ? (
            <p className="comments-pending">
              Your session is from before comments launched.{" "}
              <Link href={loginHref}>Sign in again</Link> to comment.
            </p>
          ) : (
            <p className="comments-pending">
              <Link href={loginHref}>Sign in with GitHub</Link> to comment.
            </p>
          )}

          {error ? <p className="comment-error">{error}</p> : null}
        </>
      )}
    </section>
  );
}
