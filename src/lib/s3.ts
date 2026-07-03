import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";

let cached: { client: S3Client; bucket: string; publicBase: string } | null = null;

export function getS3() {
  if (cached) return cached;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";
  const publicBase = process.env.S3_PUBLIC_BASE_URL;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
    throw new Error(
      "S3 env vars missing: need S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_BASE_URL",
    );
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
  cached = { client, bucket, publicBase: publicBase.replace(/\/+$/, "") };
  return cached;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extForImage(contentType: string): string | null {
  return EXT_BY_TYPE[contentType.toLowerCase()] ?? null;
}

export function randomKey(ext: string): string {
  return `img/${randomBytes(12).toString("hex")}.${ext}`;
}

export async function putImage(opts: {
  buffer: Buffer;
  key: string;
  contentType: string;
  cacheControl?: string;
}): Promise<string> {
  const { client, bucket, publicBase } = getS3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.buffer,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return `${publicBase}/${opts.key}`;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
