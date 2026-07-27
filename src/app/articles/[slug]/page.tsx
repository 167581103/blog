import { notFound } from "next/navigation";
import { PageFade } from "@/components/chrome/page-fade";
import { ArticleComments } from "@/components/article/article-comments";
import { IconLink } from "@/components/chrome/icon-link";
import { AccountControl } from "@/components/chrome/account-control";
import { ShareButton } from "@/components/chrome/share-button";
import {
  OptimisticArticleBody,
  OptimisticReadTitle,
} from "@/components/article/optimistic-article";
import { ReadCategoryControl } from "@/components/article/read-category-control";
import { ReadDeleteControl } from "@/components/article/read-delete-control";
import { ChevronLeftIcon } from "@/components/chrome/icons";
import { auth } from "@/lib/auth";
import { countArticlesByCategory } from "@/lib/category-counts";
import { listComments } from "@/lib/db/comments";
import { getArticle, listArticles, listCategories } from "@/lib/storage";
import { publicContent, publicTitle } from "@/lib/types";

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

  return { title: publicTitle(article) };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [article, session, categories, allArticles] = await Promise.all([
    getArticle(slug),
    auth(),
    listCategories(),
    listArticles(true),
  ]);
  if (!article) notFound();

  const isAdmin = Boolean(session?.user?.isAdmin);
  if (article.status !== "published" && !isAdmin) notFound();

  const listed =
    article.status === "published"
      ? await listComments(article.slug)
      : { comments: [], ready: false as const };

  const viewer =
    session?.user?.githubId && session.user.login
      ? {
          githubId: session.user.githubId,
          login: session.user.login,
          isAdmin,
        }
      : null;
  const needsRelogin = Boolean(session?.user?.login && !session.user.githubId);

  const signInHref = `/login?next=${encodeURIComponent(`/articles/${article.slug}`)}`;
  const accountUser =
    session?.user?.login && session.user.githubId
      ? {
          login: session.user.login,
          image: session.user.image,
        }
      : null;

  const liveTitle = publicTitle(article);
  const liveContent = publicContent(article);
  const articleCounts = isAdmin
    ? countArticlesByCategory(allArticles)
    : {};

  return (
    <div className="read-shell">
      <header className="read-bar">
        <div className="read-bar-start">
          <IconLink href="/" label="Back" prefetch>
            <ChevronLeftIcon className="h-5 w-5" />
          </IconLink>
          {isAdmin ? (
            <ReadCategoryControl
              articleSlug={article.slug}
              categories={categories}
              categorySlug={article.categorySlug}
              articleCounts={articleCounts}
            />
          ) : null}
        </div>
        <OptimisticReadTitle
          slug={article.slug}
          title={liveTitle}
          content={liveContent}
          editHref={isAdmin ? `/articles/${article.slug}/edit` : undefined}
        />
        <div className="read-bar-actions">
          {isAdmin ? <ReadDeleteControl slug={article.slug} /> : null}
          <ShareButton />
          <AccountControl user={accountUser} signInHref={signInHref} />
        </div>
      </header>

      <main className="read-body">
        <PageFade>
          <OptimisticArticleBody
            slug={article.slug}
            title={liveTitle}
            content={liveContent}
          />
          {article.status === "published" ? (
            <ArticleComments
              slug={article.slug}
              initialComments={listed.comments}
              dbReady={listed.ready}
              setupError={"error" in listed ? listed.error : undefined}
              viewer={viewer}
              needsRelogin={needsRelogin}
            />
          ) : null}
        </PageFade>
      </main>
    </div>
  );
}
