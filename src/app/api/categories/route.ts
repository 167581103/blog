import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createCategory,
  listCategories,
  reorderCategories,
} from "@/lib/storage";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const categories = await listCategories();
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const category = await createCategory(body.name);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create category";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Body: `{ slugs: string[] }` — full permutation of category slugs. */
export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { slugs?: string[] };
  if (!Array.isArray(body.slugs) || body.slugs.some((s) => typeof s !== "string")) {
    return NextResponse.json({ error: "slugs array is required" }, { status: 400 });
  }

  try {
    const categories = await reorderCategories(body.slugs);
    return NextResponse.json(categories);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder categories";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
