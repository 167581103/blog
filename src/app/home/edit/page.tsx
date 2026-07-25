import { redirect } from "next/navigation";
import { HomeEditor } from "@/components/home-editor";
import { requireAdmin } from "@/lib/auth";
import { getHomeContent } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function EditHomePage() {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const home = await getHomeContent();
  return <HomeEditor home={home} />;
}
