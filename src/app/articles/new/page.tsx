import { redirect } from "next/navigation";
import { ArticleEditor } from "@/components/article-editor";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  return <ArticleEditor mode="create" backHref="/" />;
}
