import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
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
