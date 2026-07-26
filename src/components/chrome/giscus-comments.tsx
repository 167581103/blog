"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** When true and Giscus env is incomplete, show setup guidance for the author. */
  showSetupHint?: boolean;
};

const DEFAULT_REPO = "167581103/blog";
/** Public GraphQL node id for 167581103/blog — safe to ship (NEXT_PUBLIC). */
const DEFAULT_REPO_ID = "R_kgDOTgQRdw";
const DEFAULT_CATEGORY = "Announcements";
const DEFAULT_CATEGORY_ID = "DIC_kwDOTgQRd84DCABW";

function readConfig() {
  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO?.trim() || DEFAULT_REPO;
  const repoId =
    process.env.NEXT_PUBLIC_GISCUS_REPO_ID?.trim() || DEFAULT_REPO_ID;
  const category =
    process.env.NEXT_PUBLIC_GISCUS_CATEGORY?.trim() || DEFAULT_CATEGORY;
  const categoryId =
    process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID?.trim() || DEFAULT_CATEGORY_ID;
  const configured = Boolean(repo && repoId && category && categoryId);
  return { repo, repoId, category, categoryId, configured };
}

export function GiscusComments({ showSetupHint = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { repo, repoId, category, categoryId, configured } = readConfig();

  useEffect(() => {
    if (!configured || !hostRef.current) return;
    if (hostRef.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", repo);
    script.setAttribute("data-repo-id", repoId);
    script.setAttribute("data-category", category);
    script.setAttribute("data-category-id", categoryId);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "1");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "light");
    script.setAttribute("data-lang", "zh-CN");
    script.setAttribute("data-loading", "lazy");
    hostRef.current.appendChild(script);
  }, [configured, repo, repoId, category, categoryId]);

  return (
    <section className="giscus-wrap" aria-label="Comments">
      <h2 className="giscus-heading">Comments</h2>
      {configured ? (
        <div ref={hostRef} className="giscus-host" />
      ) : showSetupHint ? (
        <div className="giscus-pending">
          <p>
            Giscus is wired up, but category IDs are missing. Finish setup:
          </p>
          <ol>
            <li>
              Enable <strong>Discussions</strong> on{" "}
              <a
                href="https://github.com/167581103/blog/settings"
                target="_blank"
                rel="noreferrer"
              >
                github.com/167581103/blog
              </a>
              .
            </li>
            <li>
              Open{" "}
              <a href="https://giscus.app" target="_blank" rel="noreferrer">
                giscus.app
              </a>
              , pick repo + a discussion category (e.g. Announcements), copy
              the category name and id.
            </li>
            <li>
              Set <code>NEXT_PUBLIC_GISCUS_CATEGORY</code> and{" "}
              <code>NEXT_PUBLIC_GISCUS_CATEGORY_ID</code> in Vercel (Production +
              Preview), then redeploy.
            </li>
          </ol>
        </div>
      ) : (
        <p className="giscus-pending">Comments will appear here once enabled.</p>
      )}
    </section>
  );
}
