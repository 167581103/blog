import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createCategory,
  listCategoryLayout,
  setCategoryRows,
} from "@/lib/storage";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const layout = await listCategoryLayout();
  return NextResponse.json(layout);
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

/**
 * Body: `{ rows: string[][] }` — homepage rows (1–3 slugs each), covering
 * every category. Legacy `{ slugs: string[] }` becomes solo rows.
 */
export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    rows?: string[][];
    slugs?: string[];
  };

  try {
    if (Array.isArray(body.rows)) {
      const layout = await setCategoryRows(body.rows);
      return NextResponse.json(layout);
    }
    if (
      Array.isArray(body.slugs) &&
      body.slugs.every((s) => typeof s === "string")
    ) {
      const layout = await setCategoryRows(body.slugs.map((slug) => [slug]));
      return NextResponse.json(layout);
    }
    return NextResponse.json(
      { error: "rows (string[][]) is required" },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update layout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
