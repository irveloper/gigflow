import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import * as Sentry from "@sentry/nextjs"
import { env } from "@/lib/env"

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

interface UploadParams {
  Bucket: string
  Key: string
  Body: Buffer
  ContentType: string
}

/**
 * Upload to S3 with 3-attempt exponential backoff (400ms → 800ms → fail).
 * Reports the final failure to Sentry before re-throwing.
 */
export async function uploadWithRetry(params: UploadParams): Promise<void> {
  const delays = [400, 800]
  let lastError: unknown

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await s3Client.send(new PutObjectCommand(params))
      return
    } catch (err) {
      lastError = err
      if (attempt < delays.length) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
      }
    }
  }

  Sentry.captureException(lastError, {
    extra: { bucket: params.Bucket, key: params.Key },
  })
  throw lastError
}

export const PRESIGNED_URL_TTL_SECONDS = 3600

// Module-level cache — lives for the lifetime of the server process
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function generatePresignedGetUrl(
  key: string,
  userId: string
): Promise<string> {
  const cacheKey = `${userId}:${key}`
  const cached = presignedUrlCache.get(cacheKey)

  // Return cached URL if more than 60s remains before expiry
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.url
  }

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
  })

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_TTL_SECONDS,
  })

  presignedUrlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000,
  })

  return url
}
