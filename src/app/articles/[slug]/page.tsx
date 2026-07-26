import { notFound } from "next/navigation";
import { PageFade } from "@/components/page-fade";
import { GiscusComments } from "@/components/giscus-comments";
import { IconLink } from "@/components/icon-link";
import { ShareButton } from "@/components/share-button";
import {
  OptimisticArticleBody,
  OptimisticReadTitle,
} from "@/components/optimistic-article";
import { ChevronLeftIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { getArticle } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article" };

  if (article.status !== "published") {
    const session = await requireAdmin();
    if (!session) return { title: "Article" };
  }

  return { title: article.title };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [article, session] = await Promise.all([
    getArticle(slug),
    requireAdmin(),
  ]);
  if (!article) notFound();
  if (article.status !== "published" && !session) notFound();

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
          editHref={session ? `/articles/${article.slug}/edit` : undefined}
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
          {article.status === "published" ? <GiscusComments /> : null}
        </PageFade>
      </main>
    </div>
  );
}
