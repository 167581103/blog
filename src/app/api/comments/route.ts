import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { COMMENT_MAX_LENGTH } from "@/lib/db/constants";
import { createComment, listComments } from "@/lib/db/comments";
import { upsertUser } from "@/lib/db/users";
import { isDbConfigured } from "@/db";
import { getArticle } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ comments: [], configured: false });
  }

  const comments = await listComments(slug);
  return NextResponse.json({ comments, configured: true });
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  }

  const session = await requireUser();
  if (!session?.user.githubId || !session.user.login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    slug?: string;
    body?: string;
  };
  const slug = body.slug?.trim();
  const text = body.body?.trim() ?? "";

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  if (text.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be at most ${COMMENT_MAX_LENGTH} characters` },
      { status: 400 },
    );
  }

  const article = await getArticle(slug);
  if (!article || article.status !== "published") {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  await upsertUser({
    id: session.user.githubId,
    login: session.user.login,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  });

  try {
    const comment = await createComment({
      articleSlug: slug,
      userId: session.user.githubId,
      body: text,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to comment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
