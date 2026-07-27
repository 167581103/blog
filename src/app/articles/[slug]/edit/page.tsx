import { notFound, redirect } from "next/navigation";
import { ArticleEditor } from "@/components/article/article-editor";
import { requireAdmin } from "@/lib/auth";
import { countArticlesByCategory } from "@/lib/category-counts";
import { getArticle, listArticles, listCategories } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function EditArticlePage({ params }: Props) {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const { slug } = await params;
  const [article, categories, articles] = await Promise.all([
    getArticle(slug),
    listCategories(),
    listArticles(true),
  ]);
  if (!article) notFound();

  return (
    <ArticleEditor
      mode="edit"
      article={article}
      categories={categories}
      articleCounts={countArticlesByCategory(articles)}
      backHref={`/articles/${article.slug}`}
    />
  );
}
