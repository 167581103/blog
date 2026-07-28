import { randomUUID } from "node:crypto";
import { isBlobConfigured } from "./blob";
import { isS3Configured, putObject, S3_CACHE } from "./s3";

/**
 * Upload editor media. Prefer S3 Access Point; fall back to Vercel Blob only
 * when S3 is not configured (legacy).
 */
export async function uploadMedia(
  file: File | Blob,
  filename: string,
): Promise<string> {
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  const pathname = `uploads/${randomUUID()}${ext}`;
  const contentType =
    (file instanceof File && file.type) || "application/octet-stream";

  if (isS3Configured()) {
    const result = await putObject({
      key: pathname,
      body: file,
      contentType,
      cacheControl: S3_CACHE.media,
    });
    return result.url;
  }

  if (!isBlobConfigured()) {
    throw new Error(
      "No media storage configured. Set S3_ACCESS_POINT_ARN (+ AWS credentials), or connect Vercel Blob.",
    );
  }

  // Legacy Blob path — kept while the store is still reachable.
  const { put } = await import("@vercel/blob");
  const { assertBlobConfigured, blobAuth, MEDIA_CACHE_MAX_AGE } =
    await import("./blob");
  assertBlobConfigured();
  const auth = await blobAuth();
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: MEDIA_CACHE_MAX_AGE,
    ...auth,
  });
  return blob.url;
}
