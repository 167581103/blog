import { PageFade } from "@/components/page-fade";
import { ArticleList } from "@/components/article-list";
import { Markdown } from "@/components/markdown";
import { IconLink } from "@/components/icon-link";
import { PencilIcon, PlusIcon } from "@/components/icons";
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
        {session ? (
          <div className="home-actions" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            <IconLink href="/home/edit" label="Edit home">
              <PencilIcon className="h-5 w-5" />
            </IconLink>
            <IconLink href="/articles/new" label="New article">
              <PlusIcon className="h-5 w-5" />
            </IconLink>
          </div>
        ) : null}

        <h1 className="brand">{home.title}</h1>
        <Markdown content={home.content} className="prose-blog lead-prose" />

        <ArticleList articles={articles} isAdmin={Boolean(session)} />
      </PageFade>
    </main>
  );
}
