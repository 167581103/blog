import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deleteArticle,
  getArticle,
  setArticleCategory,
  setArticlePinned,
  updateArticle,
} from "@/lib/storage";
import type { ArticleStatus } from "@/lib/types";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (article.status !== "published") {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json(article);
}

export async function PUT(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
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
    const article = await updateArticle(slug, {
      title: body.title,
      content: body.content ?? "",
      status: releasing || body.status === "published" ? "published" : "draft",
      slug: body.slug,
      release: releasing,
      ...(Object.prototype.hasOwnProperty.call(body, "categorySlug")
        ? { categorySlug: body.categorySlug ?? null }
        : {}),
    });

    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Lightweight metadata updates (no body rewrite):
 * - `{ categorySlug }` — move between columns
 * - `{ pinned: boolean }` — pin / unpin within the current column
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const body = (await request.json()) as {
    categorySlug?: string | null;
    pinned?: boolean;
  };

  const hasCategory = Object.prototype.hasOwnProperty.call(body, "categorySlug");
  const hasPinned = Object.prototype.hasOwnProperty.call(body, "pinned");

  if (!hasCategory && !hasPinned) {
    return NextResponse.json(
      { error: "categorySlug or pinned is required" },
      { status: 400 },
    );
  }

  try {
    let article = null;

    if (hasCategory) {
      article = await setArticleCategory(slug, body.categorySlug ?? null);
      if (!article) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (hasPinned) {
      article = await setArticlePinned(slug, Boolean(body.pinned));
      if (!article) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json(article);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const ok = await deleteArticle(slug);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, trashed: true });
}
