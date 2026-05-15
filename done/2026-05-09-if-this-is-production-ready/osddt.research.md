# Research: Is This Production Ready?

**Topic**: Full audit of the codebase against production deployment standards — security, correctness, testing, observability, deployment.

---

## Codebase Findings

### 🔴 Critical — Will break or be actively insecure in prod

#### 1. `proxy.ts` is never called — middleware doesn't exist
`proxy.ts` exports `proxy()` and `config`, but Next.js only runs middleware from a file named `middleware.ts` (or `src/middleware.ts`). There is no `middleware.ts` file. The server-side auth guard is completely disabled — unauthenticated requests reach authenticated routes without any server-side redirect. The `app/(authenticated)/layout.tsx` client-side guard is the only protection, which means:
- SSR output of protected pages is served to unauthenticated users
- Direct API calls to `/api/trpc` bypass the client guard

**Fix:** Rename `proxy.ts` → `middleware.ts` (or create `middleware.ts` that calls `proxy`).

#### 2. `next.config.mjs` has `ignoreBuildErrors: true`
TypeScript compile errors are silently skipped during `next build`. A broken build deploys successfully. This is a CI escape hatch that was never removed.

#### 3. Self-serve manager registration — anyone can get write access
The registration page allows any user to register as `"manager"`. Managers have `managerProcedure` access to create/update/delete events, hotels, and musicians. There is no admin approval step. Any person can register as a manager and manipulate all data.

#### 4. Auth tests broken — `lib/env.ts` throws at import
`__tests__/features/auth.test.ts` imports `@/features/auth/model` which imports `@/auth` which imports `@/lib/env`, which throws `Missing required environment variable: DATABASE_URL` in the test environment. Currently 1 test suite fails with exit code 1. `vitest.config.ts` has no env setup file that sets `DATABASE_URL`.

#### 5. tRPC route has no `onError` handler — stack traces may leak
`app/api/trpc/[trpc]/route.ts` doesn't configure `onError`. In development, tRPC sends full error messages. In production it suppresses them for non-`TRPCError`s, but error codes and messages from intentional `TRPCError`s are always sent. No structured logging of server errors occurs.

---

### 🟠 High — Security or correctness issue

#### 6. No security headers on HTTP responses
`next.config.mjs` has no `headers()` config. Missing:
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options: DENY` (clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Content-Security-Policy` (hardest but most important)

#### 7. No rate limiting on `/api/auth` or `/api/trpc`
Login (`/api/auth/callback/credentials`) and register (`trpc.auth.register`) endpoints have no rate limiting. Open to brute force and credential stuffing.

#### 8. `check-in` and `storage` APIs are still mock (Phase 1 placeholder)
`shared/api/check-in.ts` and `shared/api/storage.ts` return fake data. The check-in feature is not functional in production. `shared/api/storage.ts` returns `https://mock-storage.local/...` URLs.

#### 9. Auth tests test the old localStorage flow, not NextAuth
`__tests__/features/auth.test.ts` mocks `document.cookie` and `localStorage` — it tests the pre-NextAuth implementation. The new `signIn`/`signOut`/`getSession` from `next-auth/react` is never tested. Tests pass with the old mock but don't validate the real auth path.

---

### 🟡 Medium — Operational risk

#### 10. No CI/CD pipeline
No `.github/workflows/`, no Dockerfile, no Vercel config (`vercel.json`). No automated test run on push, no deployment gating.

#### 11. No error pages
No `app/error.tsx` (React error boundary for the app), no `app/not-found.tsx` (404). Next.js will show its default ugly error pages.

#### 12. `images: { unoptimized: true }` in next.config.mjs
Image optimization disabled — all images served at full resolution. Fine for dev, bad for production performance.

#### 13. No Prisma migration/seed scripts in `package.json`
`prisma migrate dev`, `prisma migrate deploy`, and `prisma db seed` are not wired into `package.json` scripts. New developers and deployment pipelines have no documented path to set up the DB.

#### 14. No structured logging
Zero logging in `server/` or `lib/`. No request IDs, no error logging to an external service (Sentry, Datadog, etc.). Silent failures in production.

#### 15. `NEXT_PUBLIC_API_URL` referenced in `shared/api/base.ts`
`shared/api/base.ts` defines an `apiRequest` helper using `NEXT_PUBLIC_API_URL`. This file isn't used by any feature — all features use tRPC directly. Dead code that references an unset env var.

---

### 🟢 Low — Polish / best practice

#### 16. `bcrypt` cost factor 12
300–500ms per hash at cost 12 on a modern server. Acceptable but could cause timeout issues on cold-start serverless environments. Cost 10 is the common production default.

#### 17. `vitest.setup.ts` exists but has no env mocks
Tests have no `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` set. Any test file that transitively imports `lib/env.ts` or `lib/prisma.ts` will throw.

#### 18. `@types/bcryptjs` installed as deprecated
`bcryptjs 3.x` ships its own types. `@types/bcryptjs` is a stub that warns on install. Can be removed.

---

## External References

- Next.js middleware: must be at `middleware.ts` root (not arbitrary filename)
- NextAuth v4 security: NEXTAUTH_SECRET required for JWT signing
- OWASP: rate limiting on auth endpoints, security headers
- Prisma 7: `prisma migrate deploy` for production (not `migrate dev`)

---

## Key Insights

1. **The middleware rename is the single most impactful fix** — without it, the server-side auth guard is completely inert.
2. **Self-serve manager registration** is a business logic security hole regardless of technical correctness.
3. **Tests are partially broken** due to `lib/env.ts` — this will block CI gating.
4. **The stack itself is production-capable** — Prisma + NextAuth + tRPC + pooling is solid. The gaps are configuration/ops, not architecture.

---

## Constraints & Risks

- `check-in` and `storage` are explicitly marked Phase 5 — not in scope for this sprint
- Fixing the auth test requires either mocking env vars in vitest or conditionally loading env validation
- CSP policy requires knowing all asset origins (CDN, fonts, etc.) — can be done in report-only mode first
- Rate limiting in Next.js App Router requires middleware or an upstream proxy (Vercel, Cloudflare, nginx)

---

## Open Questions

1. Should manager registration be blocked (invite-only) or just require admin approval post-registration?
2. Is Vercel the target deployment platform? (affects rate limiting strategy — Vercel has built-in DDoS protection but not per-route rate limiting)
3. Is Sentry or another error tracking service planned, or is stdout logging sufficient?
4. Should `next build` fail on TypeScript errors? (removing `ignoreBuildErrors` may surface pre-existing issues)
