import type { ResumeInfo } from "../types";
import { isBlobConfigured } from "./blob";
import {
  deleteObject,
  getObjectResponse,
  headObject,
  isS3Configured,
  putObject,
  S3_CACHE,
} from "./s3";

const RESUME_PATH = "site/resume.pdf";

export async function getResumeInfo(): Promise<ResumeInfo> {
  if (isS3Configured()) {
    try {
      const meta = await headObject(RESUME_PATH);
      return {
        exists: Boolean(meta),
        updatedAt: meta?.lastModified?.toISOString() ?? null,
        publicPath: "/resume.pdf",
      };
    } catch {
      return { exists: false, updatedAt: null, publicPath: "/resume.pdf" };
    }
  }

  if (!isBlobConfigured()) {
    return { exists: false, updatedAt: null, publicPath: "/resume.pdf" };
  }

  const { latestRevisionBlob } = await import("./blob");
  try {
    const latest = await latestRevisionBlob(RESUME_PATH);
    return {
      exists: Boolean(latest),
      updatedAt: latest?.uploadedAt.toISOString() ?? null,
      publicPath: "/resume.pdf",
    };
  } catch {
    return { exists: false, updatedAt: null, publicPath: "/resume.pdf" };
  }
}

/** Stream the newest resume bytes through the app (stable /resume.pdf URL). */
export async function getResumeResponse(): Promise<Response | null> {
  if (isS3Configured()) {
    return getObjectResponse(RESUME_PATH, {
      contentDisposition: 'inline; filename="resume.pdf"',
    });
  }

  if (!isBlobConfigured()) return null;

  const { latestRevisionBlob } = await import("./blob");
  const latest = await latestRevisionBlob(RESUME_PATH);
  if (!latest) return null;

  const target = new URL(latest.url);
  target.searchParams.set("v", String(latest.uploadedAt.getTime()));
  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return null;

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
}

export async function saveResume(file: File | Blob): Promise<ResumeInfo> {
  if (isS3Configured()) {
    await putObject({
      key: RESUME_PATH,
      body: file,
      contentType: "application/pdf",
      cacheControl: S3_CACHE.resume,
    });
    return getResumeInfo();
  }

  if (!isBlobConfigured()) {
    throw new Error(
      "No media storage configured. Set S3_ACCESS_POINT_ARN (+ AWS credentials), or connect Vercel Blob.",
    );
  }

  const { put } = await import("@vercel/blob");
  const { randomUUID } = await import("node:crypto");
  const {
    ARTICLE_CACHE_MAX_AGE,
    assertBlobConfigured,
    blobAuth,
    MEDIA_CACHE_MAX_AGE,
    pruneRevisions,
    revisionPrefix,
  } = await import("./blob");

  assertBlobConfigured();
  const auth = await blobAuth();
  const versionPath = `${revisionPrefix(RESUME_PATH)}${Date.now()}-${randomUUID().slice(0, 8)}.pdf`;

  await put(versionPath, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/pdf",
    cacheControlMaxAge: MEDIA_CACHE_MAX_AGE,
    ...auth,
  });

  void Promise.all([
    put(RESUME_PATH, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
      cacheControlMaxAge: ARTICLE_CACHE_MAX_AGE,
      ...auth,
    }).catch(() => undefined),
    pruneRevisions(RESUME_PATH, 5),
  ]);

  return getResumeInfo();
}

export async function deleteResume(): Promise<boolean> {
  if (isS3Configured()) {
    const before = await headObject(RESUME_PATH);
    if (!before) return false;
    await deleteObject(RESUME_PATH);
    return true;
  }

  if (!isBlobConfigured()) return false;

  const { assertBlobConfigured, deleteLogicalPath, latestRevisionBlob } =
    await import("./blob");
  assertBlobConfigured();
  const before = await latestRevisionBlob(RESUME_PATH);
  if (!before) return false;
  await deleteLogicalPath(RESUME_PATH);
  return true;
}
