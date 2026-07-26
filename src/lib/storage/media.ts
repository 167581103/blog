import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import {
  assertBlobConfigured,
  blobAuth,
  MEDIA_CACHE_MAX_AGE,
} from "./blob";

export async function uploadMedia(
  file: File | Blob,
  filename: string,
): Promise<string> {
  assertBlobConfigured();
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  const pathname = `uploads/${randomUUID()}${ext}`;
  const auth = await blobAuth();
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: MEDIA_CACHE_MAX_AGE,
    ...auth,
  });
  return blob.url;
}
