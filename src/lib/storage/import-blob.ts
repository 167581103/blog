import { list } from "@vercel/blob";
import {
  blobAuth,
  blobHostKind,
  isBlobConfigured,
  readBlobJson,
} from "./blob";
import { writeDoc } from "./docs";

export type ImportReport = {
  listed: number;
  imported: string[];
  unreadable: string[];
  hostKind: string;
  error?: string;
};

/** Logical path for a canonical blob or a `<path>.rev/<file>` snapshot. */
function logicalPath(pathname: string): string | null {
  const revAt = pathname.indexOf(".json.rev/");
  const logical =
    revAt >= 0 ? pathname.slice(0, revAt + ".json".length) : pathname;
  return logical.endsWith(".json") ? logical : null;
}

/**
 * Copy every JSON document out of Blob into Postgres, preferring the newest
 * snapshot per logical path. Meant to be run once after a blocked Blob store
 * becomes readable again.
 */
export async function importBlobDocuments(
  prefixes = ["articles/", "site/", "categories/", "trash/"],
): Promise<ImportReport> {
  if (!isBlobConfigured()) {
    return {
      listed: 0,
      imported: [],
      unreadable: [],
      hostKind: "none",
      error: "blob_not_configured",
    };
  }

  const auth = await blobAuth();
  const newest = new Map<string, { pathname: string; uploadedAt: Date }>();
  let listed = 0;
  let hostKind = "unknown";

  for (const prefix of prefixes) {
    try {
      const { blobs } = await list({ prefix, ...auth });
      listed += blobs.length;
      if (blobs.length && hostKind === "unknown") {
        hostKind = blobHostKind(blobs[0].url);
      }
      for (const blob of blobs) {
        const logical = logicalPath(blob.pathname);
        if (!logical) continue;
        const current = newest.get(logical);
        const isCanonical = blob.pathname === logical;
        if (
          !current ||
          blob.uploadedAt.getTime() > current.uploadedAt.getTime() ||
          (isCanonical &&
            blob.uploadedAt.getTime() === current.uploadedAt.getTime())
        ) {
          newest.set(logical, {
            pathname: blob.pathname,
            uploadedAt: blob.uploadedAt,
          });
        }
      }
    } catch (error) {
      return {
        listed,
        imported: [],
        unreadable: [],
        hostKind,
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      };
    }
  }

  const imported: string[] = [];
  const unreadable: string[] = [];

  for (const [logical, source] of newest) {
    const { data } = await readBlobJson<unknown>(source.pathname);
    if (data === null) {
      unreadable.push(logical);
      continue;
    }
    try {
      await writeDoc(logical, data);
      imported.push(logical);
    } catch {
      unreadable.push(logical);
    }
  }

  return { listed, imported, unreadable, hostKind };
}
