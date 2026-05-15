import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// In-process rate limiter
// Resets on Vercel cold starts — acceptable for MVP single-region deployment.
// ---------------------------------------------------------------------------
type RateLimitEntry = { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateLimitEntry>()

const RATE_LIMIT_RULES: { pathPrefix: string; maxRequests: number; windowMs: number }[] = [
  // Login: 10 attempts per 15 minutes per IP
  { pathPrefix: "/api/auth/callback/credentials", maxRequests: 10, windowMs: 15 * 60 * 1000 },
  // Registration: 5 attempts per hour per IP
  { pathPrefix: "/api/trpc/auth.register", maxRequests: 5, windowMs: 60 * 60 * 1000 },
]

function checkRateLimit(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname
  const rule = RATE_LIMIT_RULES.find((r) => pathname.startsWith(r.pathPrefix))
  if (!rule) return null

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"

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
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

// Routes that require authentication
const PROTECTED_ROUTES = ["/", "/calendar", "/profile", "/notifications", "/reports", "/admin", "/hotel", "/check-in"]

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

export function middleware(request: NextRequest) {
  // Rate limiting runs before auth checks
  const rateLimitResponse = checkRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  const { pathname } = request.nextUrl
  // NextAuth v5 (Auth.js) uses "authjs.session-token" by default,
  // but we keep "next-auth.session-token" for backwards compatibility.
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

  return NextResponse.next()
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
