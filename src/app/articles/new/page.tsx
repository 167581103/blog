import { redirect } from "next/navigation";
import { ArticleEditor } from "@/components/article/article-editor";
import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const categories = await listCategories();
  return (
    <ArticleEditor mode="create" categories={categories} backHref="/" />
  );
}
