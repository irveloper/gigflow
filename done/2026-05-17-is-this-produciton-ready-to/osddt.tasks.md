# Tasks: Production Readiness & Monetization

**Feature:** `is-this-produciton-ready-to`
**Date:** 2026-05-17

---

## Phase 0 — Foundation

> Must complete before any other phase. No new features land on a broken base.

**Dependencies:** None

- [x] [S] Upgrade `next-auth` from `5.0.0-beta.31` to `^5.0.0` stable; replace `unstable_update` with `update` in `auth.ts` — NOTE: v5 stable not yet released; `5.0.0-beta.31` IS the latest published version. Pinned exactly. `unstable_update` remains correct API for this version. No action needed.
- [x] [S] Audit NextAuth beta.31 → stable changelog; fix any breaking changes — NOTE: no upgrade available; no changelog to audit. Track https://github.com/nextauthjs/next-auth for stable v5 release.
- [x] [S] Run `pnpm test:run` after NextAuth upgrade; confirm zero failures — 61/61 passed
- [x] [M] Write Prisma migration to backfill `Event.organizationId` (set from existing org context or seed default) for any null rows — migration `20260517000000_event_org_not_null_and_indexes` created
- [x] [S] Make `Event.organizationId` non-nullable in `prisma/schema.prisma`; run migration in dev — done; relation updated to non-optional `Organization`
- [x] [S] Add `@@index([organizationId])` to `Event` model in schema — done
- [x] [S] Add `@@index([organizationId])` to `User` model in schema — done
- [x] [S] Add `@@index([isActive])` to `Musician` and `Hotel` models in schema — done
- [x] [S] Run `pnpm test:run` after schema changes; confirm zero failures — 61/61 passed

**Definition of Done:** `pnpm test:run` passes, `next-auth` is on stable, `Event.organizationId` is non-nullable with index, all new indexes exist in schema.

---

## Phase 1 — Billing

> Depends on: Phase 0 complete

**Dependencies:** Phase 0

- [x] [S] Install deps: `pnpm add stripe @stripe/stripe-js` — stripe@22.1.1, @stripe/stripe-js@9.5.0
- [x] [S] Add Stripe + billing env vars to `lib/env.ts` validation: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_ANNUAL`, `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [x] [S] Create `lib/stripe.ts` — singleton Stripe server client — includes PLANS config and seatLimitForPrice helper
- [x] [M] Add `Subscription` model to `prisma/schema.prisma`; run migration — model added, migration `20260517000001_add_subscription` created
- [x] [S] Add `Subscription` Zod schema to `specs/entities/subscription.schema.ts`; export type from `shared/types/index.ts` — schema at `entities/subscription/schema.ts`, exported via `specs/entities/index.ts` and `shared/types/index.ts`; `OrganizationStatusSchema` updated to new values
- [x] [S] Seed dev: create default `active` Subscription rows for existing orgs in `prisma/seed.ts` — added upserts for org-1 (Growth) and org-2 (Starter) with dev placeholder Stripe IDs
- [x] [M] Create `server/routers/billing.ts` with procedures: `createCheckoutSession`, `createPortalSession`, `getSubscription`, `cancelSubscription` — also added `getPlans`; `cancelSubscription` handled via Stripe Portal
- [x] [S] Register `billingRouter` in `server/routers/index.ts`
- [x] [M] Create Stripe webhook handler `app/api/webhooks/stripe/route.ts`; handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
- [x] [S] Validate Stripe webhook signature in handler using `STRIPE_WEBHOOK_SECRET` — uses `stripe.webhooks.constructEvent`
- [x] [M] Gate `organizations.create` mutation: before creating org, require `stripeCustomerId` from completed Checkout session (pass `sessionId` as input, verify on server) — `create` replaced with `initiateCheckout`; org creation moved to webhook handler post-payment
- [x] [M] Add subscription enforcement to `orgProcedure` in `server/trpc.ts`: load `Subscription`, throw `FORBIDDEN` if `status` is `suspended` or `canceled`; attach `subscription` to ctx
- [x] [M] Enforce seat limit in `admin.createUser`: check `ctx.subscription.seatLimit` vs active user count; throw `FORBIDDEN` with `SEAT_LIMIT_REACHED` if at cap
- [x] [M] Create `app/onboarding/plan/page.tsx` — plan selector with 3 tier cards (Starter/Growth/Pro, monthly/annual toggle); calls `createCheckoutSession`
- [x] [S] Create `app/onboarding/success/page.tsx` — polls `getSubscription` for up to 30s after Checkout redirect; shows spinner then redirects to org dashboard
- [x] [M] Create `app/org/[slug]/settings/billing/page.tsx` — shows plan name, seat usage (X/Y), next billing date, status badge; "Manage billing" button → `createPortalSession`
- [x] [S] Update `Organization.status` comment in schema to reflect new values: `trialing | active | past_due | suspended | canceled` — done alongside OrganizationStatusSchema update
- [x] [S] Update middleware subscription status check: redirect suspended/canceled orgs to `/billing-suspended` page; create that page — `/billing-suspended` page created; suspension enforced at tRPC `orgProcedure` layer (DB call in middleware per-request too expensive without edge KV)

**Definition of Done:** New org creation requires Stripe Checkout. Webhook syncs subscription state. Suspended orgs cannot access tRPC. Seat limit blocks user creation at cap. Billing settings page loads with correct plan info.

---

## Phase 2 — Auth Hardening

> Depends on: Phase 0 complete (Phase 1 can run in parallel)

**Dependencies:** Phase 0

- [x] [S] Install deps: `pnpm add resend` — resend@6.12.3
- [x] [S] Add email env vars to `lib/env.ts`: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- [x] [S] Create `lib/email.ts` — Resend client singleton + `sendEmail(to, subject, html)` helper
- [x] [S] Create email templates in `lib/email-templates.ts`: `verifyEmail(name, link)`, `resetPassword(name, link)`, `trialExpiringSoon(name, daysLeft, link)`
- [x] [M] Update `auth.register` mutation in `server/routers/auth.ts`: after user creation, generate verification token (store in existing `VerificationToken` table), send verification email via Resend — also added `resendVerification` mutation
- [x] [M] Create `app/api/auth/verify-email/route.ts` — GET handler: validate token, set `User.emailVerified = now()`, delete token, redirect to `/auth/login?verified=1`
- [x] [S] Update `middleware.ts`: if authenticated user has `emailVerified = null` → redirect to `/auth/pending` — uses `auth()` for JWT decode on protected routes only; `emailVerified` added to JWT/session
- [x] [M] Update `app/auth/pending/page.tsx`: add "Resend verification email" button → calls new `auth.resendVerification` tRPC mutation — page now handles both email-verify (`?verify=1`) and role-pending flows
- [x] [S] Add `auth.resendVerification` mutation: rate-limited, generates new token, sends email — added alongside register update
- [x] [M] Add `PasswordResetToken` model to `prisma/schema.prisma`; run migration — also added `LoginAuditLog` model; migration `20260517000002_add_auth_hardening_tables` created
- [x] [M] Add `auth.requestPasswordReset(email)` public procedure: generate token, send reset email; always return generic success (no email-existence leak)
- [x] [M] Create `app/api/auth/reset-password/route.ts` — POST: validate token (not used, not expired), hash new password, set `User.password`, set token `usedAt`, delete all user sessions via `prisma.session.deleteMany`
- [x] [S] Create `app/auth/forgot-password/page.tsx` — email input form
- [x] [S] Create `app/auth/reset-password/page.tsx` — new password form (reads `token` from query param)
- [x] [S] Update login page: add "Forgot password?" link to `/auth/forgot-password`
- [x] [M] Add login audit logging to `auth.ts` `authorize()` callback: `prisma.loginAuditLog.create(...)` on success and failure; pass IP via `x-forwarded-for` header — uses `next/headers` for IP; failures logged before returning null
- [x] [M] Add `admin.listLoginHistory` paginated procedure (managerProcedure): return `LoginAuditLog` rows filtered to current org's user emails
- [x] [S] Create `app/org/[slug]/settings/security/page.tsx` — table of recent logins (email, outcome, IP, timestamp)

**Definition of Done:** Unverified users redirected to pending page. Verification email sent on register. Password reset flow works end-to-end. All logins logged with IP. Security page shows login history.

---

## Phase 3 — Security & Performance

> Depends on: Phase 0 complete

**Dependencies:** Phase 0

- [x] [S] Install deps: `pnpm add @upstash/redis @upstash/ratelimit` — @upstash/ratelimit@2.0.8, @upstash/redis@1.38.0
- [x] [S] Add Upstash env vars to `lib/env.ts`: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — optional; fallback to in-process when absent
- [x] [M] Create `lib/ratelimit.ts` — Upstash `loginRateLimit` (10/15m) and `registerRateLimit` (5/1h) instances — exports null when env vars absent
- [x] [M] Replace in-process Map-based rate limiting in `middleware.ts` with Upstash calls; return 429 with `Retry-After` header on limit exceeded — in-process fallback kept when Upstash not configured
- [x] [M] Move CSP out of static headers in `next.config.mjs`; remove `unsafe-inline` from `script-src` and `style-src` — nonce-based CSP in middleware
- [x] [M] Generate CSP nonce in `middleware.ts` per request (`crypto.randomUUID()`); set `x-nonce` response header; inject nonce into CSP value — done
- [x] [M] Update `app/layout.tsx`: read `x-nonce` from `headers()`; pass nonce to all `<Script>` tags and any inline styles — layout reads nonce; no Script tags currently
- [x] [S] Add Stripe.js CDN (`js.stripe.com`) and Sentry CDN to CSP `script-src`; add `*.ingest.sentry.io` to `connect-src` — in buildCsp() in middleware.ts
- [x] [S] Add cursor-based pagination input/output types to `specs/entities/pagination.schema.ts` — also offset types; exported via specs/entities/index.ts
- [x] [M] Add cursor-based pagination to `events.getAll` tRPC procedure: `limit`, `cursor` input; `items`, `nextCursor`, `total` output
- [x] [M] Add offset-based pagination to `musicians.getAll`, `hotels.getAll`, `admin.listUsers`: `limit`, `offset` input; `items`, `total` output
- [x] [M] Update Effector models (`features/*/model.ts`) to handle paginated responses from list endpoints — added $eventsTotal, $musiciansTotal, $hotelsTotal stores; fn: data => data.items on doneData
- [x] [S] Update UI components to render paginated lists with load-more or page controls — admin-musicians, admin-hotels, admin/users all have load-more buttons; billing page updated

**Definition of Done:** No `unsafe-inline` in CSP header. Rate limits survive server restart (verified via Upstash dashboard). All list endpoints return `{ items, nextCursor|offset, total }`. UI paginates correctly.

---

## Phase 4 — Testing & Ops

> Depends on: Phases 0–3 complete (can partially overlap with Phase 3)

**Dependencies:** Phases 0–3

- [x] [M] Add `vitest.integration.ts` config (separate from unit tests); add `pnpm test:integration` script to `package.json`
- [x] [S] Create `__tests__/api/helpers.ts` — `createTestCaller(role, orgId, subscriptionStatus?)` returning a tRPC caller with fake session
- [x] [M] Create `__tests__/api/events.test.ts` — integration tests: getAll (paginated), getById, create, update, delete; wrong-org + unauth rejection
- [x] [M] Create `__tests__/api/musicians.test.ts` — getAll, create, update, delete; auth rejection
- [x] [M] Create `__tests__/api/hotels.test.ts` — getAll, create, update, delete; auth rejection
- [x] [M] Create `__tests__/api/billing.test.ts` — getSubscription, seat limit enforcement, suspended org rejection
- [x] [M] Create `__tests__/api/organizations.test.ts` — checkSlug, getMyOrg, update; cross-tenant isolation check
- [x] [M] Create `__tests__/api/admin.test.ts` — listUsers, createUser (seat limit), deactivateUser; role rejection
- [x] [S] Create `lib/s3.ts` (extract S3 logic from wherever it currently lives); wrap `PutObjectCommand` in `uploadWithRetry` (3 attempts, exponential backoff 400ms/800ms); report final failure to Sentry
- [x] [S] Replace all direct `s3.send(new PutObjectCommand(...))` calls with `uploadWithRetry` — app/api/upload/checkin-photo/route.ts updated
- [x] [M] Write `docs/runbook.md`: Prerequisites, First deployment steps, Env var reference, DB migration procedure, Vercel project setup, Stripe webhook registration, Post-deploy checklist, Rollback procedure, Secret rotation guide
- [x] [S] Increase Sentry `tracesSampleRate` to `0.2` for launch; add custom tags `org.id`, `org.slug` to server requests in `server/trpc.ts` via sentryOrgMiddleware
- [x] [S] Add `<Analytics />` from `@vercel/analytics` and `<SpeedInsights />` from `@vercel/speed-insights` to `app/layout.tsx`
- [x] [M] Add metrics to superadmin dashboard `app/superadmin/page.tsx`: active org count, trialing count, suspended count; total user count — computed from organizations.listAll data
- [x] [S] Run `pnpm test:run` — 61/61 passed. `pnpm test:integration` requires a live DB (excluded from CI unit run)

**Definition of Done:** `pnpm test:integration` passes for all 6 router test files. S3 retry logic in place. Runbook covers full deploy procedure. Sentry org tags flowing. Vercel Analytics active. Superadmin metrics page shows live counts.

---

## Summary

| Phase | Tasks | Complexity | Est. Days |
|-------|-------|-----------|-----------|
| 0 — Foundation | 9 | S/M | 2–3 |
| 1 — Billing | 18 | S/M/L | 5–7 |
| 2 — Auth Hardening | 17 | S/M | 3–4 |
| 3 — Security/Perf | 14 | S/M | 2–3 |
| 4 — Testing/Ops | 16 | S/M | 3–4 |
| **Total** | **74** | | **15–21** |

## Execution Order

```
Phase 0
  ├── Phase 1 (billing)
  ├── Phase 2 (auth hardening)  ← can run parallel with Phase 1
  └── Phase 3 (security/perf)  ← can run parallel with Phase 1+2
       └── Phase 4 (testing/ops)
```
