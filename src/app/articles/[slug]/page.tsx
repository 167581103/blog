import { notFound } from "next/navigation";
import { PageFade } from "@/components/chrome/page-fade";
import { ArticleComments } from "@/components/article/article-comments";
import { IconLink } from "@/components/chrome/icon-link";
import { ShareButton } from "@/components/chrome/share-button";
import {
  OptimisticArticleBody,
  OptimisticReadTitle,
} from "@/components/article/optimistic-article";
import { ChevronLeftIcon } from "@/components/chrome/icons";
import { auth } from "@/lib/auth";
import { isDbConfigured } from "@/db";
import { listComments } from "@/lib/db/comments";
import { getArticle } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article" };

  if (article.status !== "published") {
    const session = await auth();
    if (!session?.user?.isAdmin) return { title: "Article" };
  }

  return { title: article.title };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [article, session] = await Promise.all([getArticle(slug), auth()]);
  if (!article) notFound();

  const isAdmin = Boolean(session?.user?.isAdmin);
  if (article.status !== "published" && !isAdmin) notFound();

  const dbConfigured = isDbConfigured();
  const comments =
    article.status === "published" && dbConfigured
      ? await listComments(article.slug)
      : [];

  const viewer =
    session?.user?.githubId && session.user.login
      ? {
          githubId: session.user.githubId,
          login: session.user.login,
          isAdmin,
        }
      : null;

  return (
    <div className="read-shell">
      <header className="read-bar">
        <IconLink href="/" label="Back" prefetch>
          <ChevronLeftIcon className="h-5 w-5" />
        </IconLink>
        <OptimisticReadTitle
          slug={article.slug}
          title={article.title}
          content={article.content}
          editHref={isAdmin ? `/articles/${article.slug}/edit` : undefined}
        />
        <ShareButton />
      </header>

      <main className="read-body">
        <PageFade>
          <OptimisticArticleBody
            slug={article.slug}
            title={article.title}
            content={article.content}
          />
          {article.status === "published" ? (
            <ArticleComments
              slug={article.slug}
              initialComments={comments}
              dbConfigured={dbConfigured}
              viewer={viewer}
            />
          ) : null}
        </PageFade>
      </main>
    </div>
  );
}
