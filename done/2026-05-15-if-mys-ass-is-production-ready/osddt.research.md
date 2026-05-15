# Research: Is This Production Ready?

**Topic**: Full re-audit of production readiness as of 2026-05-15. A prior sprint (`done/2026-05-09-if-this-is-production-ready`) addressed 7 phases of hardening. This research assesses what was completed, what remains, and identifies any new gaps.

---

## Prior Sprint Status

All 7 phases from the 2026-05-09 sprint are **marked complete** in `osddt.tasks.md`. Key items shipped:

| Item | Status |
|------|--------|
| `proxy.ts` renamed → `middleware.ts` (auth guard active) | ✅ Done |
| `ignoreBuildErrors: true` removed from next.config | ✅ Done |
| Manager self-registration blocked (UI + server) | ✅ Done |
| Vitest env vars stubbed (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`) | ✅ Done |
| Security headers (`X-Frame-Options`, HSTS, `nosniff`, `Referrer-Policy`) | ✅ Done |
| In-process rate limiting (login: 10/15min, register: 5/1hr) | ✅ Done |
| Sentry (`@sentry/nextjs`) integrated — client, server, edge | ✅ Done |
| tRPC `onError` → `Sentry.captureException` for `INTERNAL_SERVER_ERROR` | ✅ Done |
| `app/error.tsx` branded error boundary + Sentry capture | ✅ Done |
| `app/not-found.tsx` branded 404 | ✅ Done |
| `db:migrate` + `db:seed` scripts in `package.json` | ✅ Done |
| Idempotent `prisma/seed.ts` with demo users/data | ✅ Done |
| Admin user management page (`/admin/users`) | ✅ Done |

**Test suite**: 53/53 pass. All clean.

---

## Codebase Findings — Remaining Gaps

### 🔴 Critical

None. The most dangerous gaps from the prior audit are resolved.

---

### 🟠 High

#### 1. Content-Security-Policy (CSP) header missing
`next.config.mjs` sets 5 security headers but no `Content-Security-Policy`. The prior research noted this as "hardest but most important." Without CSP, XSS attacks can exfiltrate session tokens and execute arbitrary scripts. The app uses:
- Next.js (inline scripts for hydration)
- `@sentry/nextjs` (external reporting endpoint)
- `react-day-picker`, `recharts`, `embla-carousel` (bundled — no CDN)
- No external font CDN (fonts are Tailwind defaults / system fonts)

A `report-only` policy first is the safe path.

#### 2. Check-in and storage still mock
`shared/api/check-in.ts` and `shared/api/storage.ts` return fake data and `https://mock-storage.local/...` URLs. The check-in feature (`/check-in/[eventId]`) is visible in the UI but non-functional. The check-in tRPC router (`server/routers/events.ts`) has a `checkIn` mutation that writes to the DB, but the front-end uses `shared/api/check-in.ts` (the mock). The client-side feature model (`features/check-in/model.ts`) calls the mock, not the tRPC router.

This is a **feature gap** rather than a security issue, but it means the primary differentiating feature of this platform is non-functional in prod.

#### 3. Rate limiter is in-process — resets on cold starts
The `middleware.ts` rate limiter uses a module-scoped `Map`. On Vercel, each cold start (or edge function instance) starts with a fresh counter. A determined attacker can bypass by triggering cold starts or hitting different instances. Acceptable for MVP (as documented in a code comment), but documented here as a known gap.

---

### 🟡 Medium

#### 4. No CI/CD pipeline
No `.github/workflows/`, no `vercel.json`. Tests are not gated on push. A broken commit can be merged and deployed. `pnpm test:run` and `pnpm build` are not automatically run in CI.

#### 5. No `NEXTAUTH_URL` in prod `.env.local.example` note
`.env.local` has `NEXTAUTH_URL=http://localhost:3000`. In production this must be the real domain. The `.env.local.example` sets it but has no comment warning about this. Developers may forget to update it for deployment.

#### 6. `isActive` flag not enforced on login
`auth.ts` `authorize()` finds a user and verifies password, but does **not** check `dbUser.isActive`. A deactivated user (`isActive: false`) can still log in. The admin panel's "Deactivate" action in `adminRouter.deactivateUser` sets `isActive: false` in the DB, but the login path ignores it.

#### 7. No input sanitization on free-text fields
`prisma.event.create` accepts `title`, `description`, `hotel`, `musician` as raw strings with no sanitization beyond Zod type checks. Zod validates shape but not content (no max-length, no control character stripping). These values are rendered in the UI — if a future change moves to `dangerouslySetInnerHTML`, stored XSS becomes a risk. Current shadcn/Next.js rendering escapes these, so this is low-risk now but fragile.

---

### 🟢 Low

#### 8. `bcrypt` cost factor 12 on serverless
Still at cost 12 (~300–500ms per hash). On Vercel's default 1-second function timeout for free tier, a slow bcrypt during login or registration could timeout. Cost 10 is standard production recommendation.

#### 9. No `robots.txt` or `sitemap.xml`
No `public/robots.txt`. Next.js will return 404 for `/robots.txt`. The matcher in `middleware.ts` already excludes `robots.txt` and `sitemap.xml` from auth — they just don't exist. This is SEO/crawler hygiene, not a blocker.

#### 10. No health check endpoint
No `/api/health` route. Vercel handles uptime monitoring externally, but if the app is behind any load balancer or uptime checker, there's no lightweight ping endpoint.

#### 11. Demo credentials hardcoded in login page UI
`app/auth/login/page.tsx` shows "Demo Accounts" with hardcoded emails (`musico@test.com`, `gerente@test.com`, `hotel@test.com`) and passwords (`123456`). This is fine for demo/staging but should be removed or gated behind `NODE_ENV !== "production"` before a real production launch.

#### 12. `BACKEND.md` describes Supabase but app uses Prisma + NextAuth
`BACKEND.md` documents Supabase CLI, RLS policies, `supabase start`, etc. The actual implementation uses Prisma + pg + NextAuth. This causes confusion for new developers. The doc is stale/wrong.

---

## External References

- OWASP CSP: https://owasp.org/www-community/attacks/Content_Security_Policy
- Next.js headers docs: `next.config.mjs` `headers()` function
- NextAuth `isActive` check: the `authorize` callback is the correct place
- Vercel function timeout: 10s hobby, 60s pro (cost 12 bcrypt should be safe on pro)

---

## Key Insights

1. **The stack is production-capable.** All critical gaps from the prior sprint are resolved. Tests pass. Auth guard active. Rate limiting in place. Error tracking wired.
2. **Biggest remaining risk is CSP** — without it, XSS can bypass all other protections.
3. **Check-in is the only non-functional feature.** Everything else (events, admin, calendar, notifications, profile) is wired to real Prisma/tRPC calls.
4. **`isActive` on login is a real bug** — the admin deactivation feature silently doesn't work.
5. **Demo credentials in prod UI** is the most embarrassing gap if this gets deployed publicly.

---

## Constraints & Risks

- CSP with `nonce` requires Next.js App Router integration (`generateBuildId` or per-request nonces) — moderately complex
- Fixing `bcrypt` cost factor requires DB re-hash of all passwords — needs migration or "re-hash on next login" strategy
- Check-in mock → real implementation requires deciding on file storage (S3, Supabase Storage, or Vercel Blob)

---

## Open Questions

1. **Should check-in be unblocked?** If so, what storage provider? The `docker-compose.yml` only has Postgres — no object storage.
2. **Is public launch imminent?** If yes, demo credentials in the login UI must be gated.
3. **Which Vercel plan?** (Affects bcrypt timeout risk and rate limiter behavior)
4. **CSP scope:** Start with `report-only` or ship enforcing from day 1?
5. **`isActive` fix priority:** Deactivation was built as a feature — does it need to actually work?
