import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { env } from "@/lib/env"
import { uploadWithRetry } from "@/lib/s3"

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  const eventId = formData.get("eventId")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  if (typeof eventId !== "string" || !eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, or WebP." }, { status: 415 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 413 })
  }

  const ext = file.type.split("/")[1]
  const timestamp = Date.now()
  const key = `checkins/${session.user.id}/${eventId}/${timestamp}.${ext}`

  try {
    await uploadWithRetry({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "S3 upload failed"
    console.error("[upload/checkin-photo] S3 error:", err)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ key })
}
