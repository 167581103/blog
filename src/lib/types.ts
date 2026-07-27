export type ArticleStatus = "draft" | "published";

/** Site column / section. Articles belong to at most one. */
export type Category = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Article = {
  id: string;
  slug: string;
  /** Working copy — what the editor edits. */
  title: string;
  content: string;
  status: ArticleStatus;
  /** Official placement — updated on Release (and create), not draft saves. */
  categorySlug: string | null;
  /**
   * Last released snapshot for public read.
   * Null while never published; after first Release always set.
   */
  publishedTitle: string | null;
  publishedContent: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type HomeContent = {
  title: string;
  content: string;
  updatedAt: string;
};

export type ArticleInput = {
  title: string;
  content: string;
  status: ArticleStatus;
  slug?: string;
  /**
   * When provided (including null), updates official category.
   * Omit on draft saves so placement stays unchanged.
   */
  categorySlug?: string | null;
  /** When true, commit working copy → published snapshot (+ category). */
  release?: boolean;
};

export type ResumeInfo = {
  exists: boolean;
  updatedAt: string | null;
  publicPath: "/resume.pdf";
};

/** True when a published article’s working copy differs from the live snapshot. */
export function hasUnpublishedChanges(article: Article): boolean {
  if (article.status !== "published") return false;
  if (
    article.publishedTitle === null &&
    article.publishedContent === null
  ) {
    // Legacy published rows without a snapshot are treated as in sync.
    return false;
  }
  return (
    article.title !== (article.publishedTitle ?? article.title) ||
    article.content !== (article.publishedContent ?? article.content)
  );
}

/** Title shown to the public (and on the read page). */
export function publicTitle(article: Article): string {
  if (article.status === "published") {
    return article.publishedTitle ?? article.title;
  }
  return article.title;
}

/** Body shown to the public (and on the read page). */
export function publicContent(article: Article): string {
  if (article.status === "published") {
    return article.publishedContent ?? article.content;
  }
  return article.content;
}
