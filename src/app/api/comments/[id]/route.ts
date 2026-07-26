import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteComment } from "@/lib/db/comments";
import { isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  }

  const session = await requireUser();
  if (!session?.user.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ok = await deleteComment({
      id,
      userId: session.user.githubId,
      isAdmin: Boolean(session.user.isAdmin),
    });
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
