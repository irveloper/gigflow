import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { generatePresignedGetUrl } from "@/lib/s3"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key: segments } = await params
  const key = segments.join("/")

  if (!key.startsWith("checkins/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const presignedUrl = await generatePresignedGetUrl(key, session.user.id)

  return NextResponse.redirect(presignedUrl, { status: 302 })
}
