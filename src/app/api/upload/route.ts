import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function isAllowed(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  return ALLOWED_PREFIXES.some((p) => file.type.startsWith(p));
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 20MB)" },
      { status: 400 },
    );
  }

  // Empty MIME (some desktop pastes) — allow if it has a filename.
  if (file.type && !isAllowed(file)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  try {
    const url = await uploadMedia(file, file.name || "upload");
    return NextResponse.json({ url, filename: file.name, size: file.size });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
