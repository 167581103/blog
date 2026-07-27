import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/storage";

/**
 * Vercel Cron: purge soft-deleted articles older than 30 days.
 * Secure with CRON_SECRET (Authorization: Bearer …).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await purgeExpiredTrash();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to purge trash";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
