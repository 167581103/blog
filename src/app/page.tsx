import { PageFade } from "@/components/chrome/page-fade";
import { AdminArticleSections } from "@/components/article/admin-article-sections";
import { ArticleList } from "@/components/article/article-list";
import { OptimisticHome } from "@/components/home/optimistic-home";
import { auth } from "@/lib/auth";
import { getHomeContent, listArticles, listCategories } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, home, all, categories] = await Promise.all([
    auth(),
    getHomeContent(),
    listArticles(true),
    listCategories(),
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
          <AdminArticleSections articles={articles} categories={categories} />
        ) : (
          <ArticleList articles={articles} categories={categories} />
        )}
      </PageFade>
    </main>
  );
}
