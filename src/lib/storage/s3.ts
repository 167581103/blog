import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

/**
 * AWS S3 (Access Point) for static media: editor uploads and resume PDF.
 *
 * Required:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   AWS_REGION (or S3_REGION)
 *   S3_ACCESS_POINT_ARN  — e.g. arn:aws:s3:ap-southeast-2:ACCOUNT:accesspoint/blog
 *     (or S3_BUCKET for a normal bucket name)
 *
 * Optional:
 *   S3_PUBLIC_BASE_URL — CloudFront / custom CDN origin (no trailing slash).
 *     When unset, browser URLs go through `/api/media/...` so the Access Point
 *     can stay private.
 */

const MEDIA_CACHE_CONTROL = "public, max-age=2592000, immutable";
const RESUME_CACHE_CONTROL = "public, max-age=60, must-revalidate";

function region() {
  return (
    process.env.S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    ""
  );
}

/** Bucket name or Access Point ARN accepted by the S3 API. */
function bucket(): string {
  const raw =
    process.env.S3_ACCESS_POINT_ARN?.trim() ||
    process.env.S3_BUCKET?.trim() ||
    "";
  // Accept either ARN or the accidental `s3://arn:...` form.
  return raw.replace(/^s3:\/\//, "");
}

function hasCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

export function isS3Configured(): boolean {
  return Boolean(bucket() && region() && hasCredentials());
}

export function assertS3Configured() {
  if (!isS3Configured()) {
    throw new Error(
      "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_ACCESS_POINT_ARN (or S3_BUCKET).",
    );
  }
}

let _client: S3Client | null = null;

function client(): S3Client {
  assertS3Configured();
  if (!_client) {
    _client = new S3Client({
      region: region(),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }
  return _client;
}

/**
 * Browser-facing URL for an object.
 * Prefer an explicit CDN base; otherwise serve via the app media proxy so the
 * Access Point does not need a public GetObject policy.
 */
export function publicObjectUrl(key: string): string {
  const clean = key.replace(/^\//, "");
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/${clean}`;
  return `/api/media/${clean}`;
}

async function bodyToUint8Array(body: Blob | File | Buffer | Uint8Array) {
  if (body instanceof Uint8Array) return body;
  if (Buffer.isBuffer(body)) return body;
  return new Uint8Array(await body.arrayBuffer());
}

export async function putObject(input: {
  key: string;
  body: Blob | File | Buffer | Uint8Array;
  contentType?: string;
  cacheControl?: string;
}): Promise<{ key: string; url: string }> {
  assertS3Configured();
  const key = input.key.replace(/^\//, "");
  const bytes = await bodyToUint8Array(input.body);

  // Multipart upload handles large pastes without buffering twice in SDK.
  const upload = new Upload({
    client: client(),
    params: {
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: input.contentType || "application/octet-stream",
      CacheControl: input.cacheControl || MEDIA_CACHE_CONTROL,
    },
  });
  await upload.done();

  return { key, url: publicObjectUrl(key) };
}

export async function headObject(key: string): Promise<{
  key: string;
  contentType: string | null;
  contentLength: number | null;
  lastModified: Date | null;
} | null> {
  if (!isS3Configured()) return null;
  try {
    const res = await client().send(
      new HeadObjectCommand({
        Bucket: bucket(),
        Key: key.replace(/^\//, ""),
      }),
    );
    return {
      key: key.replace(/^\//, ""),
      contentType: res.ContentType ?? null,
      contentLength: res.ContentLength ?? null,
      lastModified: res.LastModified ?? null,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey") return null;
    // AccessDenied on missing keys sometimes surfaces as 404-like codes.
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

export async function getObjectResponse(
  key: string,
  opts?: { contentDisposition?: string },
): Promise<Response | null> {
  if (!isS3Configured()) return null;
  try {
    const res = await client().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key.replace(/^\//, ""),
      }),
    );
    if (!res.Body) return null;

    const headers = new Headers();
    headers.set(
      "Content-Type",
      res.ContentType || "application/octet-stream",
    );
    if (res.ContentLength != null) {
      headers.set("Content-Length", String(res.ContentLength));
    }
    headers.set(
      "Cache-Control",
      res.CacheControl || MEDIA_CACHE_CONTROL,
    );
    if (opts?.contentDisposition) {
      headers.set("Content-Disposition", opts.contentDisposition);
    } else if (res.ContentDisposition) {
      headers.set("Content-Disposition", res.ContentDisposition);
    }
    if (res.ETag) headers.set("ETag", res.ETag);
    if (res.LastModified) {
      headers.set("Last-Modified", res.LastModified.toUTCString());
    }

    // Convert the SDK stream into a Web ReadableStream for Next Response.
    const bytes = await res.Body.transformToByteArray();
    return new Response(Buffer.from(bytes), { status: 200, headers });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  assertS3Configured();
  await client().send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: key.replace(/^\//, ""),
    }),
  );
}

export const S3_CACHE = {
  media: MEDIA_CACHE_CONTROL,
  resume: RESUME_CACHE_CONTROL,
};
