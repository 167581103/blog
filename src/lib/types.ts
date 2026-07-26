export type ArticleStatus = "draft" | "published";

export type Article = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: ArticleStatus;
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
};

export type ResumeInfo = {
  exists: boolean;
  updatedAt: string | null;
  publicPath: "/resume.pdf";
};
