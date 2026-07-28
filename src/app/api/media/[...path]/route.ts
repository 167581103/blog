import { NextResponse } from "next/server";
import { getObjectResponse, isS3Configured } from "@/lib/storage/s3";

export const runtime = "nodejs";

/**
 * Authenticated proxy for private S3 Access Point objects.
 * Used when S3_PUBLIC_BASE_URL is unset so editor uploads still render.
 *
 * Only allows keys under `uploads/` and `site/` — never arbitrary paths.
 */
function safeKey(segments: string[]): string | null {
  if (!segments.length) return null;
  const key = segments.map(decodeURIComponent).join("/");
  if (key.includes("..") || key.startsWith("/")) return null;
  if (!key.startsWith("uploads/") && !key.startsWith("site/")) return null;
  return key;
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, ctx: Ctx) {
  if (!isS3Configured()) {
    return NextResponse.json({ error: "S3 not configured" }, { status: 503 });
  }

  const { path } = await ctx.params;
  const key = safeKey(path);
  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const response = await getObjectResponse(key);
    if (!response) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return response;
  } catch (error) {
    console.error(
      "[media] proxy failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Failed to fetch object" }, { status: 502 });
  }
}
