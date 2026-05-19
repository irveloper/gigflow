# Research: Is This Production-Ready to Make Money With This SaaS?

**Feature name:** `is-this-produciton-ready-to`
**Branch:** `main`
**Date:** 2026-05-16

---

## Topic

Full production-readiness audit of the music event platform SaaS. Goal: determine what is blocking monetization and launch.

---

## Codebase Findings

### Auth & Security (7/10)

**Strengths:**
- NextAuth v5 JWT strategy with bcrypt cost-12 password hashing
- Role-based procedures: `publicProcedure`, `protectedProcedure`, `managerProcedure`, `musicianProcedure`, `hotelProcedure`, `orgProcedure`, `superAdminProcedure`
- In-process rate limiting: 10 login attempts/15min, 5 registrations/hour
- Security headers: HSTS, `X-Frame-Options: DENY`, CSP, `X-Content-Type-Options`, referrer policy
- 58-line middleware guard with proper redirects

**Gaps:**
- CSP has `unsafe-inline` — explicit TODO in `next.config.mjs` line 35 to upgrade to nonce-based
- Rate limiting is in-process → resets on Vercel cold starts, broken in multi-region
- No password reset flow
- No email verification
- No login audit logging (critical for compliance)

### Multi-Tenancy / Org Model (9/10)

**Strengths:**
- Explicit junction tables: `HotelOrganization`, `MusicianOrganization`
- All queries validate `organizationId`: events, hotels, musicians, admin.listUsers
- `orgProcedure` enforces tenant context on all org-scoped operations
- Superadmin bypass works correctly
- App layout (`app/org/[slug]/layout.tsx` lines 19–28) validates slug vs session

**Gaps:**
- `Event.organizationId` is nullable — comment says "required once all rows are backfilled" (in-progress migration)
- Org isolation is application-only — no database-level constraints
- Platform-wide musician search (intentional per comments, but increases data exposure)

### Payment / Billing (0/10 — BLOCKER)

- Zero references to Stripe, billing, subscription, or payment in entire codebase
- `organizations.create` has no payment gate — anyone can create an org for free
- No subscription tiers, usage limits, trial management, invoicing, or metering
- **This is the primary blocker for monetization**

### Database Schema (7/10)

- 14 tables, 194 lines, Prisma 7 with pg adapter
- Models: `User`, `Account`, `Session`, `VerificationToken`, `Organization`, `HotelOrganization`, `MusicianOrganization`, `Musician`, `Hotel`, `Event`, `Notification`
- JSON column for `Event.checkInLocation` (not native pg `Point` type)
- Denormalized `Event.hotel` / `Event.musician` strings (stale name risk)
- **No index on `Event.organizationId`** — full table scans for org queries
- No soft-delete, no audit trail, no `created_by`/`updated_by`

### API Layer / tRPC (8/10)

**Routers:** auth, admin, events, musicians, hotels, notifications, organizations  
All protected. No public endpoints except `auth.register`.

**Gaps:**
- No pagination on any list endpoint (`listUsers`, `getAll`)
- No query logging for production debugging
- No Sentry error reporting in tRPC error handlers
- Musicians search is unrestricted (platform-wide)

### Environment & Config (7/10)

**Required:** `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`  
**Optional:** Sentry DSN vars  
Runtime validation enforced (throws on missing).

**Gaps:**
- Seed password hardcoded to `"123456"` in `prisma/seed.ts`
- No `.env.production` documentation
- No secrets rotation guidance
- AWS credentials via env vars (not IAM role assumption)

### Tests (4/10)

~1,100 lines across 16 files: auth, org, events, hotels, check-in, musicians, notifications, calendar.  
Effector-based model unit tests. Good scenario documentation.

**Gaps:**
- No API integration tests against actual tRPC routes
- No database query tests
- No security tests (org isolation, role bypass)
- No E2E tests (Playwright/Cypress)
- Estimated < 30% code coverage

### Error Handling & Monitoring (6/10)

**Good:** Global `app/error.tsx`, Sentry client+server in production, `TRPCError` with proper codes.

**Gaps:**
- No error recovery / retry logic
- S3 upload failures throw hard (no circuit breaker)
- Sentry tracing at 10% sample rate (misses rare edge cases)
- No structured logging
- No request timeouts

### Dependencies

- `next` 16.2.4 ✓
- `next-auth` 5.0.0-beta.31 ⚠️ **beta — not stable**
- `@prisma/client` 7.8.0 ✓
- `@trpc/server` 11.17.0 ✓
- `@sentry/nextjs` 10.52.0 ✓
- `typescript` 6.x ✓
- **NextAuth on beta.31 is the biggest dependency risk**

---

## External References

- NextAuth v5 migration guide (beta → RC breaking changes)
- Stripe subscription integration docs
- PostgreSQL partial index docs (for `Event.organizationId`)
- Vercel rate limiting alternatives (Upstash Redis)

---

## Key Insights

1. **Architecture is sound.** Multi-tenancy, FSD structure, Effector models, tRPC procedures — all well-designed. The foundation is production-grade.
2. **Payment is totally absent.** There is no path to charging users right now. This is not an oversight — it simply hasn't been built yet.
3. **NextAuth beta risk.** The entire auth system sits on an unstable dependency. Pin it and track RC release.
4. **Org isolation is application-only.** One bad query could leak cross-org data. Needs DB-level row security or at minimum indices + constraints.
5. **Tests cover client logic, not API.** You can ship broken tRPC routes and the test suite will stay green.

---

## Constraints & Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No payment integration | Critical | Can't charge users |
| NextAuth on beta.31 | High | Breaking change in RC/stable path |
| No API integration tests | High | Silent API regressions |
| In-process rate limiting | Medium | Multi-region failure, cold start reset |
| Missing Event.organizationId index | Medium | Table scans at scale |
| Unsafe-inline CSP | Medium | XSS attack surface |
| No email verification | Medium | Account takeover risk |
| No GDPR tooling | Low-Medium | Legal exposure in EU markets |

---

## Open Questions

1. **What is the target monetization model?** Per-org subscription? Per-seat? Usage-based? This determines Stripe integration scope.
2. **Who is the buyer?** Event managers? Musicians? Hotels? Affects pricing tiers and feature gating.
3. **What is the launch timeline?** 4-6 weeks for MVP paid tier; 8-10 weeks for full production hardening.
4. **Is NextAuth v5 stable enough?** Monitor beta.31 → RC release. Consider pinning until RC.
5. **What compliance requirements apply?** GDPR (EU)? SOC 2? Affects auth audit logging, data retention, deletion scope.
6. **Self-hosted or Vercel?** Rate limiting strategy depends on deployment target.

---

## Readiness Score: 6.2/10

| Dimension | Score |
|-----------|-------|
| Auth & Security | 7/10 |
| Multi-tenancy | 9/10 |
| **Payment/Billing** | **0/10** |
| Database Schema | 7/10 |
| API Layer | 8/10 |
| Environment/Config | 7/10 |
| Tests | 4/10 |
| Error Handling | 6/10 |
| Missing Features | 3/10 |
| Dependencies | 8/10 |

### Must-Have Before Paid Launch (4–6 weeks)
1. Stripe subscription integration + payment gate on org creation
2. Database index on `Event.organizationId`
3. Nonce-based CSP
4. API integration tests (tRPC routes)
5. Login audit logging
6. Production deployment runbook

### Should-Have (2–3 additional weeks)
7. Email verification + password reset
8. Pagination on all list endpoints
9. Error recovery + S3 retry logic
10. Distributed rate limiting (Upstash Redis)
11. Production metrics dashboard
