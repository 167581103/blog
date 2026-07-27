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
  title: string;
  content: string;
  status: ArticleStatus;
  /** Official placement — updated on Release, not draft saves. */
  categorySlug: string | null;
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
};

export type ResumeInfo = {
  exists: boolean;
  updatedAt: string | null;
  publicPath: "/resume.pdf";
};
