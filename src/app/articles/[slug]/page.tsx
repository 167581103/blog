import { notFound } from "next/navigation";
import { PageFade } from "@/components/page-fade";
import { Markdown } from "@/components/markdown";
import { GiscusComments } from "@/components/giscus-comments";
import { IconLink } from "@/components/icon-link";
import { ShareButton } from "@/components/share-button";
import { ReadTitle } from "@/components/read-title";
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
  const article = await getArticle(slug);
  if (!article) notFound();

  const session = await requireAdmin();
  if (article.status !== "published" && !session) notFound();

  return (
    <div className="read-shell">
      <header className="read-bar">
        <IconLink href="/" label="Back">
          <ChevronLeftIcon className="h-5 w-5" />
        </IconLink>
        <ReadTitle
          title={article.title}
          editHref={session ? `/articles/${article.slug}/edit` : undefined}
        />
        <ShareButton />
      </header>

      <main className="read-body">
        <PageFade>
          <Markdown content={article.content} />
          {article.status === "published" ? <GiscusComments /> : null}
        </PageFade>
      </main>
    </div>
  );
}
