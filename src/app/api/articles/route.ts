import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createArticle, listArticles } from "@/lib/storage";
import type { ArticleStatus } from "@/lib/types";

export async function GET() {
  const session = await requireAdmin();
  const articles = await listArticles(Boolean(session));
  return NextResponse.json(articles);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    content?: string;
    status?: ArticleStatus;
    slug?: string;
    categorySlug?: string | null;
    release?: boolean;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const releasing = Boolean(body.release);
    const article = await createArticle({
      title: body.title,
      content: body.content ?? "",
      status: releasing || body.status === "published" ? "published" : "draft",
      slug: body.slug,
      release: releasing,
      ...(Object.prototype.hasOwnProperty.call(body, "categorySlug")
        ? { categorySlug: body.categorySlug ?? null }
        : {}),
    });
    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
