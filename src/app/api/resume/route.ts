import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deleteResume,
  getResumeInfo,
  saveResume,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const info = await getResumeInfo();
  return NextResponse.json(info);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json(
      { error: "Resume must be a PDF" },
      { status: 400 },
    );
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 20MB)" },
      { status: 400 },
    );
  }

  try {
    const info = await saveResume(file);
    return NextResponse.json(info);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ok = await deleteResume();
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...(await getResumeInfo()) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
