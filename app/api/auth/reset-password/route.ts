import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { token, password } = body

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!record) {
    return NextResponse.json({ error: "Invalid or already used token" }, { status: 400 })
  }

  if (record.usedAt) {
    return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 })
  }

  if (record.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } })
    return NextResponse.json({ error: "Reset link has expired. Request a new one." }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    // Update password
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    }),
    // Mark token used
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    // Invalidate all active sessions
    prisma.session.deleteMany({
      where: { userId: record.userId },
    }),
  ])

  return NextResponse.json({ success: true })
}
