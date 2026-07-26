import { PageFade } from "@/components/chrome/page-fade";
import { ArticleList } from "@/components/article/article-list";
import { OptimisticHome } from "@/components/home/optimistic-home";
import { auth } from "@/lib/auth";
import { getHomeContent, listArticles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, home, all] = await Promise.all([
    auth(),
    getHomeContent(),
    listArticles(true),
  ]);
  const isAdmin = Boolean(session?.user?.isAdmin);
  const articles = isAdmin
    ? all
    : all.filter((a) => a.status === "published");

  return (
    <main className="site-shell">
      <PageFade>
        <OptimisticHome
          title={home.title}
          content={home.content}
          editHref={isAdmin ? "/home/edit" : undefined}
        />
        <ArticleList articles={articles} isAdmin={isAdmin} />
      </PageFade>
    </main>
  );
}
