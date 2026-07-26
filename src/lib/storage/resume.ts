import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { ResumeInfo } from "../types";
import {
  ARTICLE_CACHE_MAX_AGE,
  assertBlobConfigured,
  blobAuth,
  deleteLogicalPath,
  latestRevisionBlob,
  MEDIA_CACHE_MAX_AGE,
  pruneRevisions,
  revisionPrefix,
} from "./blob";

const RESUME_PATH = "site/resume.pdf";

export async function getResumeInfo(): Promise<ResumeInfo> {
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
  assertBlobConfigured();
  const before = await latestRevisionBlob(RESUME_PATH);
  if (!before) return false;
  await deleteLogicalPath(RESUME_PATH);
  return true;
}
