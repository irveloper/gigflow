import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { unstable_update } from "@/auth"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  if (!token || !email) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_link", request.url))
  }

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  })

  if (!record) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_token", request.url))
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    })
    return NextResponse.redirect(new URL("/auth/pending?error=expired", request.url))
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    }),
  ])

  // Detect whether the user has an active session.
  const sessionCookieValue =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("next-auth.session-token")?.value ??
    request.cookies.get("__Secure-next-auth.session-token")?.value

  if (sessionCookieValue) {
    // User is logged in — update their JWT in-place so they skip re-authentication.
    // unstable_update() triggers the jwt callback with { trigger: "update" } and
    // the emailVerified field is now propagated (added in auth.config.ts).
    await unstable_update({ user: { emailVerified: new Date() } })
    return NextResponse.redirect(new URL("/auth/pending", request.url))
  }

  // User is not logged in — force a fresh JWT on next login by clearing the old token.
  // The `from` param ensures the middleware sends them to /auth/pending (create-org
  // mode) after they log in, rather than to the home page.
  const redirectResponse = NextResponse.redirect(
    new URL("/auth/login?verified=1&from=/auth/pending", request.url),
  )
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]
  for (const name of cookieNames) {
    redirectResponse.cookies.set(name, "", { maxAge: 0, path: "/" })
  }
  return redirectResponse
}
