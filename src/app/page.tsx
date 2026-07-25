import { PageFade } from "@/components/page-fade";
import { ArticleList } from "@/components/article-list";
import { OptimisticHome } from "@/components/optimistic-home";
import { requireAdmin } from "@/lib/auth";
import { getHomeContent, listArticles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, home, all] = await Promise.all([
    requireAdmin(),
    getHomeContent(),
    listArticles(true),
  ]);
  const articles = session
    ? all
    : all.filter((a) => a.status === "published");

  return (
    <main className="site-shell">
      <PageFade>
        <OptimisticHome
          title={home.title}
          content={home.content}
          editHref={session ? "/home/edit" : undefined}
        />
        <ArticleList articles={articles} isAdmin={Boolean(session)} />
      </PageFade>
    </main>
  );
}
