import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importBlobDocuments } from "@/lib/storage/import-blob";

/**
 * One-shot recovery: pull legacy JSON documents out of Vercel Blob into
 * Postgres. Useful after a blocked Blob store starts serving downloads again.
 */
export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await importBlobDocuments();
  return NextResponse.json(report, { status: report.error ? 502 : 200 });
}
