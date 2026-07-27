import { redirect } from "next/navigation";
import { ArticleEditor } from "@/components/article/article-editor";
import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ category?: string }> };

export default async function NewArticlePage({ searchParams }: Props) {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const [{ category: rawCategory }, categories] = await Promise.all([
    searchParams,
    listCategories(),
  ]);
  const initialCategorySlug =
    typeof rawCategory === "string" &&
    categories.some((c) => c.slug === rawCategory)
      ? rawCategory
      : null;

  return (
    <ArticleEditor
      mode="create"
      categories={categories}
      initialCategorySlug={initialCategorySlug}
      backHref="/"
    />
  );
}
