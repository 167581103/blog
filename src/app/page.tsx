import { PageFade } from "@/components/page-fade";
import { ArticleList } from "@/components/article-list";
import { BrandTitle } from "@/components/brand-title";
import { Markdown } from "@/components/markdown";
import { requireAdmin } from "@/lib/auth";
import { getHomeContent, listArticles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireAdmin();
  const [home, articles] = await Promise.all([
    getHomeContent(),
    listArticles({ includeDrafts: Boolean(session) }),
  ]);

  return (
    <main className="site-shell">
      <PageFade>
        <BrandTitle
          title={home.title}
          editHref={session ? "/home/edit" : undefined}
        />
        <Markdown content={home.content} className="prose-blog lead-prose" />

        <ArticleList articles={articles} isAdmin={Boolean(session)} />
      </PageFade>
    </main>
  );
}
