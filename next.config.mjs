import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg", "pg-native", "@prisma/client", "prisma"],
  // Legacy path compatibility: routes that moved to /org/[slug]/...
  // Static redirects can't know the user's org slug, so we redirect to root
  // which then server-redirects to /org/[slug] via app/page.tsx
  async redirects() {
    return [
      { source: "/admin/:path*", destination: "/", permanent: false },
      { source: "/calendar", destination: "/", permanent: false },
      { source: "/reports", destination: "/", permanent: false },
      { source: "/profile", destination: "/", permanent: false },
      { source: "/notifications", destination: "/", permanent: false },
      { source: "/hotel/dashboard", destination: "/", permanent: false },
      { source: "/check-in/:path*", destination: "/", permanent: false },
    ]
  },
  // CSP is set per-request in middleware.ts using a nonce.
  // Only keep static security headers here for assets served without middleware.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Silent Sentry build output to avoid noise
  silent: true,
  // Don't expose source maps to clients
  hideSourceMaps: true,
  // Automatically instrument Next.js data fetching
  widenClientFileUpload: true,
})
