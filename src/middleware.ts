import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import NextAuth from "next-auth"
import authConfig from "@/auth.config"
import { rateLimiters } from "@/lib/ratelimit"

const { auth } = NextAuth(authConfig)

// ---------------------------------------------------------------------------
// In-process rate limiter — fallback when Upstash is not configured
// Resets on Vercel cold starts — acceptable for MVP single-region deployment.
// ---------------------------------------------------------------------------
type RateLimitEntry = { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateLimitEntry>()

const RATE_LIMIT_RULES: { pathPrefix: string; maxRequests: number; windowMs: number; limiterKey: "loginRateLimit" | "registerRateLimit" }[] = [
  { pathPrefix: "/api/auth/callback/credentials", maxRequests: 10, windowMs: 15 * 60 * 1000, limiterKey: "loginRateLimit" },
  { pathPrefix: "/api/trpc/auth.register", maxRequests: 5, windowMs: 60 * 60 * 1000, limiterKey: "registerRateLimit" },
]

async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  const rule = RATE_LIMIT_RULES.find((r) => pathname.startsWith(r.pathPrefix))
  if (!rule) return null

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"

  // Upstash path
  if (rateLimiters) {
    const limiter = rateLimiters[rule.limiterKey]
    const { success, reset } = await limiter.limit(ip)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      )
    }
    return null
  }

  // In-process fallback
  const key = `${ip}:${rule.pathPrefix}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs })
    return null
  }

  entry.count++

  if (entry.count > rule.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// CSP nonce generation
// ---------------------------------------------------------------------------
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce-trusted scripts load further scripts
    // 'unsafe-eval' required by React in dev mode for call stack reconstruction
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://browser.sentry-cdn.com`,
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://*.amazonaws.com",
    "font-src 'self' data:",
    `connect-src 'self' https://*.ingest.sentry.io https://api.stripe.com${isDev ? " ws: wss:" : ""}`,
    `frame-src 'self' https://js.stripe.com${isDev ? " http://localhost:*" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

// Routes that require authentication
const PROTECTED_ROUTES = ["/", "/calendar", "/profile", "/notifications", "/reports", "/admin", "/hotel", "/check-in", "/org", "/superadmin", "/account"]

// Routes that authenticated users should NOT access (pending is excluded — it's for authenticated users)
const AUTH_ROUTES = ["/auth/login", "/auth/register"]

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  )
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export async function middleware(request: NextRequest) {
  // Rate limiting runs before auth checks
  const rateLimitResponse = await checkRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  const { pathname } = request.nextUrl

  // Fast cookie-presence check (no DB call) for redirect logic
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("next-auth.session-token")?.value ??
    request.cookies.get("__Secure-next-auth.session-token")?.value

  const isAuthenticated = Boolean(sessionToken)

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute(pathname) && isAuthenticated) {
    const from = request.nextUrl.searchParams.get("from") || "/"
    // Prevent open redirect — only allow relative paths
    const safeFrom = from.startsWith("/") && !from.startsWith("//") ? from : "/"
    return NextResponse.redirect(new URL(safeFrom, request.url))
  }

  // Email verification check — only for protected routes with a session
  // Skips /auth/pending itself to avoid redirect loop
  if (
    isAuthenticated &&
    isProtectedRoute(pathname) &&
    pathname !== "/auth/pending" &&
    !pathname.startsWith("/api/")
  ) {
    const session = await auth()
    if (session?.user && !session.user.emailVerified) {
      return NextResponse.redirect(new URL("/auth/pending?verify=1", request.url))
    }

    // Block unverified users from reaching the org-creation page directly.
    if (pathname.startsWith("/org/new") && session?.user && !session.user.emailVerified) {
      return NextResponse.redirect(new URL("/auth/pending?verify=1", request.url))
    }

    // Guard A: org owner with verified email but no org → send back to complete onboarding.
    if (
      session?.user?.role === "manager" &&
      session.user.emailVerified &&
      !session.user.organizationId
    ) {
      return NextResponse.redirect(new URL("/auth/pending", request.url))
    }

    // Guard B: member (musician/hotel) with verified email but no org → waiting-for-invite page.
    if (
      (session?.user?.role === "musician" || session?.user?.role === "hotel") &&
      session.user.emailVerified &&
      !session.user.organizationId &&
      !pathname.startsWith("/account/pending-org")
    ) {
      return NextResponse.redirect(new URL("/account/pending-org", request.url))
    }

    // Redirect org users from legacy non-org routes to their org-scoped equivalent.
    // Superadmin and pending users have no organizationSlug — they pass through unchanged.
    const orgSlug = session?.user?.organizationSlug
    if (orgSlug && !pathname.startsWith("/org/") && !pathname.startsWith("/superadmin")) {
      return NextResponse.redirect(new URL(`/org/${orgSlug}${pathname}`, request.url))
    }
  }

  // Generate per-request CSP nonce and inject into response headers
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const response = NextResponse.next()
  response.headers.set("x-nonce", nonce)
  response.headers.set("Content-Security-Policy", buildCsp(nonce))
  // Keep other security headers that were previously in next.config.mjs
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  response.headers.set("X-DNS-Prefetch-Control", "off")
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
