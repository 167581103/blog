import { PageFade } from "@/components/chrome/page-fade";
import { AdminArticleSections } from "@/components/article/admin-article-sections";
import { ArticleList } from "@/components/article/article-list";
import { OptimisticHome } from "@/components/home/optimistic-home";
import { auth } from "@/lib/auth";
import {
  getHomeContent,
  listArticles,
  listCategoryLayout,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, home, all, layout] = await Promise.all([
    auth(),
    getHomeContent(),
    listArticles(true),
    listCategoryLayout(),
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
        {isAdmin ? (
          <AdminArticleSections articles={articles} layout={layout} />
        ) : (
          <ArticleList articles={articles} layout={layout} />
        )}
      </PageFade>
    </main>
  );
}
