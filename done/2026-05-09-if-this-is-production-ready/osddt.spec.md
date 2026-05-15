# Spec: Production Hardening

## Overview

The PlugIn Cancún platform has a working feature set but several gaps prevent safe deployment to production. This spec covers the set of changes needed to make the app deployable with confidence — covering server-side security enforcement, access control correctness, test reliability, and operational basics.

The goal is not new features. It is removing the ways things can silently break, be exploited, or fail without anyone knowing.

---

## Session Context

This spec follows two prior sessions:
1. The T3 stack was implemented (Prisma 7, NextAuth v4, tRPC v11, Effector, pg.Pool, RBAC procedures, pending-role guard, env validation).
2. A production audit identified 5 critical and 5 high-severity gaps (see Research Summary).

The user confirmed: Effector stays, Prisma not Supabase SDK, NextAuth not Supabase Auth. No new features — this sprint is hardening only.

---

## Research Summary

The audit (`osddt.research.md`) found:

- **Middleware dead** — `proxy.ts` is never invoked by Next.js. Server-side auth is completely inert.
- **Build silently accepts broken code** — `ignoreBuildErrors: true` skips TypeScript checks.
- **Manager self-registration** — anyone can claim manager role and write to all data.
- **Tests broken** — `lib/env.ts` throws in the test environment, blocking CI.
- **No error logging** — server errors fail silently with no trace.
- **No security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all absent.
- **No rate limiting** — login and register endpoints open to brute force.
- **Auth tests stale** — still test the old localStorage flow, not NextAuth.
- **No CI/CD** — no automated test or build gate on push.
- **No error pages** — Next.js default error UI in production.
- **DB scripts missing** — no `migrate deploy` or `seed` commands wired up.

The stack architecture (Prisma + NextAuth + tRPC + pooling) is sound. All gaps are configuration, ops, and access control — not architecture.

---

## Requirements

### 1. Server-side route protection is enforced
- Unauthenticated users who navigate directly to a protected URL (e.g. `/`, `/admin`, `/calendar`) are redirected to `/auth/login` by the server before any page HTML is rendered or returned.
- This protection applies to direct browser navigation, curl requests, and crawlers — not only to client-side transitions.

### 2. Manager role cannot be self-assigned
- The registration form does not offer "Manager" as a selectable role.
- New users may register as Musician or Hotel only.
- Manager accounts are created exclusively by an existing manager through the admin panel, or seeded directly in the database.

### 3. The test suite passes with zero failures in CI
- Running `pnpm test:run` succeeds with exit code 0 in an environment where `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are not set (e.g. a CI runner with no database).
- Auth model tests exercise the real NextAuth-backed auth flow (mocked at the network boundary), not the removed localStorage flow.

### 4. A production build fails loudly on TypeScript errors
- Running `pnpm build` exits non-zero if there are TypeScript type errors.
- Broken code cannot be deployed accidentally.

### 5. HTTP responses include baseline security headers
- Every response from the app includes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` (HSTS).
- These headers apply to all routes including API routes.

### 6. Auth and register endpoints have basic abuse protection
- Repeated failed login attempts from the same IP are slowed or blocked.
- The register endpoint cannot be called at an unlimited rate.
- Protection does not require a third-party service — it should work with the existing infrastructure.

### 7. Server-side errors are logged and not leaked to clients
- When an unexpected error occurs in a tRPC handler, the error details are logged server-side (stdout at minimum).
- The client receives a generic error response, not a stack trace or internal message.

### 8. The app has graceful error and not-found pages
- When a runtime error occurs in the app, users see a branded error page with a "go home" action — not a raw Next.js error screen.
- When a user navigates to a nonexistent URL, they see a branded 404 page.

### 9. Database setup is documented and scriptable
- `pnpm db:migrate` applies pending migrations against the target database.
- `pnpm db:seed` seeds the database with demo fixture data.
- Both commands work in local development and in a CI environment (with `DATABASE_URL` set).

### 10. Image optimization is enabled
- Production builds serve optimized images (WebP/AVIF where supported, resized to display dimensions).

---

## Scope

### In scope
- Activating Next.js middleware for server-side auth enforcement
- Removing manager from the self-registration role options
- Fixing test environment so all tests pass without a real database
- Updating auth tests to mock at the NextAuth layer
- Removing `ignoreBuildErrors: true`
- Adding security headers via `next.config.mjs`
- Adding in-process rate limiting on auth endpoints via middleware
- Adding tRPC `onError` with stdout logging
- Adding `app/error.tsx` and `app/not-found.tsx`
- Adding `db:migrate` and `db:seed` npm scripts
- Removing `images: { unoptimized: true }` from next config
- Removing the dead `shared/api/base.ts` file and `@types/bcryptjs` dev dep

### Out of scope
- Check-in and photo storage (Phase 5 — explicitly deferred)
- Full Content-Security-Policy (requires asset inventory — separate spike)
- External error tracking service (Sentry, Datadog — separate decision)
- CI/CD pipeline (`.github/workflows/`) — separate infra decision
- Email verification for new accounts
- Password reset flow

---

## Acceptance Criteria

1. `curl -I https://<prod-domain>/` returns `Location: /auth/login` with HTTP 307/308 for an unauthenticated request.
2. The registration form has two role options: Musician and Hotel. "Manager" is not present.
3. `pnpm test:run` exits 0 with all tests passing in a shell with no `DATABASE_URL` set.
4. `pnpm build` exits non-zero when there is a deliberate TypeScript error in any source file.
5. `curl -I https://<prod-domain>/` response headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Strict-Transport-Security`.
6. 20 rapid POST requests to `/api/auth/callback/credentials` from the same IP results in rate-limit responses (HTTP 429) before the 20th attempt completes.
7. An intentional `throw new Error("test")` inside a tRPC handler produces a server log line and returns `{ code: "INTERNAL_SERVER_ERROR" }` to the client — no stack trace in the response body.
8. Navigating to `/does-not-exist` renders the branded 404 page.
9. `pnpm db:migrate` and `pnpm db:seed` each complete without error when `DATABASE_URL` points to a live Postgres instance.
10. A production build (`NODE_ENV=production`) serves images with `Content-Type: image/webp` or `image/avif` for supported clients.

---

## Open Questions

1. **Manager registration**: Should managers only be creatable by other managers through the admin panel (strictest), or is direct DB seeding sufficient as a bootstrap path? This determines whether the admin panel needs a "Create Manager" flow or just a "Create User" flow.

2. **Target deployment platform**: Vercel, self-hosted (Docker/nginx), or something else? This determines what rate-limiting approach is available and whether security headers can be handled at the CDN/proxy layer instead of in the app.

3. **Error tracking**: Is stdout logging (`console.error`) sufficient for this sprint, or should Sentry (or similar) be wired up before going live?

4. **TypeScript strictness**: Removing `ignoreBuildErrors: true` will surface any existing type errors (there are pre-existing ones in `components/ui/resizable.tsx` and the test files). Should those be fixed in this sprint, or should we accept them with a targeted suppression while enforcing new code strictly?
