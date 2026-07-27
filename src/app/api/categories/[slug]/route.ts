import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteCategory, renameCategory } from "@/lib/storage";

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const category = await renameCategory(slug, body.name);
    if (!category) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename category";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Delete an empty column. Fails if any article still uses it. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  try {
    const layout = await deleteCategory(slug);
    return NextResponse.json(layout);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete category";
    if (message === "Category not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("still has articles")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
