# Plan: Production Readiness & Monetization

**Feature:** `is-this-produciton-ready-to`
**Date:** 2026-05-17
**Stack:** Next.js 16 · tRPC 11 · Prisma 7 · NextAuth v5 stable · Stripe · Resend · Upstash Redis · Vercel

---

## Architecture Overview

### Billing model
Three tiered per-org subscriptions with seat caps. Stripe Checkout handles payment collection; Stripe Customer Portal handles plan changes and cancellation. Webhook syncs subscription state back to DB.

| Tier | Price | Seat cap |
|------|-------|----------|
| Starter | $29/mo | 3 |
| Growth | $79/mo | 10 |
| Pro | $199/mo | 25 |

Annual pricing: 2 months free (10× monthly = annual price).

### Subscription state machine
```
(new org) → trialing (7 days, card on file)
         → active (payment succeeds)
         → past_due (payment failed, grace period)
         → suspended (grace expired or trial expired without payment)
         → canceled (owner canceled; access until period_end, then suspended)
```
`Organization.status` already exists. Extend to: `trialing | active | past_due | suspended | canceled`.

### Auth email flows
Use **Resend** for transactional email. Three flows: verification, password reset, trial-expiry warning.

### Rate limiting
Replace in-process Maps with **Upstash Redis** via `@upstash/ratelimit`. Same logic, distributed state.

### CSP nonces
Move CSP from static `next.config.mjs` headers to middleware. Middleware generates a nonce per request, passes it via response header, Next.js `<Script nonce>` consumes it.

---

## New Dependencies

```
stripe                     # Stripe Node SDK
@stripe/stripe-js          # Stripe.js (client)
resend                     # Transactional email
@upstash/redis             # Redis client
@upstash/ratelimit         # Rate limit primitives
```

Remove: none (existing deps kept).

Upgrade: `next-auth@5.0.0-beta.31` → `next-auth@^5.0.0` (stable).

---

## New Environment Variables

```
# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER_MONTHLY
STRIPE_PRICE_STARTER_ANNUAL
STRIPE_PRICE_GROWTH_MONTHLY
STRIPE_PRICE_GROWTH_ANNUAL
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_ANNUAL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Email
RESEND_API_KEY
RESEND_FROM_EMAIL              # e.g. noreply@yourdomain.com

# Upstash Redis
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

---

## Schema Changes

### New models

```prisma
model Subscription {
  id                   String    @id @default(cuid())
  organizationId       String    @unique
  stripeCustomerId     String    @unique
  stripeSubscriptionId String?   @unique
  stripePriceId        String?
  status               String    // trialing | active | past_due | suspended | canceled
  trialEndsAt          DateTime?
  currentPeriodEnd     DateTime?
  seatLimit            Int       @default(3)
  cancelAtPeriodEnd    Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model LoginAuditLog {
  id        String   @id @default(cuid())
  email     String
  userId    String?
  outcome   String   // success | failure
  ipAddress String?
  userAgent String?
  timestamp DateTime @default(now())

  @@index([userId])
  @@index([timestamp])
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique
  expires   DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Modified models

```prisma
// User — add emailVerified enforcement flag
model User {
  // existing fields...
  emailVerified DateTime?   // already exists — now enforced in middleware
}

// Organization — extend status values comment
model Organization {
  // status: trialing | active | past_due | suspended | canceled (was: active | inactive)
}

// Event — make organizationId non-nullable + add index
model Event {
  organizationId String    // remove ? — after backfill migration
  @@index([organizationId])
}
```

---

## Implementation Phases

### Phase 0 — Foundation (2–3 days)

Goal: Clean up blockers before adding new features.

**0.1 Upgrade NextAuth to stable**
- `pnpm add next-auth@^5.0.0`
- Replace `unstable_update` → `update` in `auth.ts`
- Check NextAuth v5 stable changelog for beta.31 → stable breaking changes
- Run `pnpm test:run` to verify nothing broke

**0.2 Fix Event.organizationId**
- Write migration: backfill `Event.organizationId` from existing data (set to first org if ambiguous, or use seed default)
- Remove `?` from `organizationId String?` → `organizationId String`
- Add `@@index([organizationId])` to `Event` model
- Add `@@index([organizationId])` to `Notification` model (via `userId → user.organizationId` or add direct)
- Run migration in dev, verify no nulls

**0.3 Add missing indexes**
- `Event`: `organizationId` (done above)
- `Musician`: already has `@unique email` — add `@@index([isActive])`
- `Hotel`: add `@@index([isActive])`
- `User`: add `@@index([organizationId])`

---

### Phase 1 — Billing (5–7 days)

Goal: Org owners pay before accessing platform.

**1.1 Stripe setup**
- Create Stripe account + Products + Prices (6 prices: 3 tiers × monthly/annual)
- Store Price IDs in env vars
- Add `stripe` + `@stripe/stripe-js` deps
- Create `lib/stripe.ts` — singleton Stripe client

**1.2 Schema migration**
- Add `Subscription` model
- Migration: create `Subscription` table
- For existing orgs in dev: seed a default `active` subscription

**1.3 Billing tRPC router** — `server/routers/billing.ts`
```
createCheckoutSession(priceId, orgName, orgSlug) → { url }
createPortalSession() → { url }
getSubscription() → Subscription
cancelSubscription() → void
```

**1.4 Stripe webhook handler** — `app/api/webhooks/stripe/route.ts`

Handle events:
- `checkout.session.completed` → create Subscription row, activate org
- `customer.subscription.updated` → sync status, seatLimit, currentPeriodEnd
- `customer.subscription.deleted` → set status = suspended
- `invoice.payment_failed` → set status = past_due
- `invoice.payment_succeeded` → set status = active (if was past_due)

Validate webhook signature with `STRIPE_WEBHOOK_SECRET`. Return 200 fast, process async.

**1.5 Gate org creation**
- `organizations.create` mutation: before creating org, call Stripe to create a Customer and initiate Checkout Session
- Flow: user picks plan → Stripe Checkout → webhook activates org → user lands in dashboard
- New route: `app/onboarding/plan/page.tsx` — plan selector with 3 tier cards
- New route: `app/onboarding/success/page.tsx` — post-Checkout redirect page (waits for webhook, polls `getSubscription`)

**1.6 Subscription enforcement in `orgProcedure`**
- In `server/trpc.ts`, `orgProcedure` middleware: after resolving `organizationId`, load `Subscription` from DB
- If `status` is `suspended` or `canceled`: throw `FORBIDDEN` with code `SUBSCRIPTION_INACTIVE`
- If `status` is `past_due`: allow read-only (mutating procedures check explicitly)
- Attach `subscription` to ctx for downstream procedures

**1.7 Seat limit enforcement**
- In `admin.createUser` and wherever users are added to an org: check `ctx.subscription.seatLimit` vs current active user count
- Throw `FORBIDDEN` with code `SEAT_LIMIT_REACHED` if at cap

**1.8 Billing UI page** — `app/org/[slug]/settings/billing/page.tsx`
- Show: plan name, seat usage (X/Y), next billing date, status badge
- Buttons: "Manage billing" → createPortalSession → redirect to Stripe Portal
- "Upgrade plan" → createCheckoutSession with new priceId

---

### Phase 2 — Auth Hardening (3–4 days)

Goal: Block unverified users; add password reset; log all logins.

**2.1 Email service**
- `pnpm add resend`
- `lib/email.ts` — Resend client + typed `sendEmail(to, subject, html)` helper
- Email templates (plain HTML strings, no framework needed):
  - `verifyEmail(name, link)`
  - `resetPassword(name, link)`
  - `trialExpiringSoon(name, daysLeft, link)`

**2.2 Email verification**
- `auth/register` tRPC mutation: after creating user, generate signed token (crypto.randomBytes), store in `VerificationToken` (already exists in NextAuth schema), send verification email via Resend
- New route: `app/api/auth/verify-email/route.ts` — GET handler, validates token, sets `User.emailVerified = now()`, redirects to login
- Middleware: if `session.user.emailVerified` is null → redirect to `/auth/pending` (page already exists)
- `app/auth/pending/page.tsx` (already exists) — add resend button → new `auth.resendVerification` tRPC mutation

**2.3 Password reset**
- Schema: add `PasswordResetToken` model
- `auth.requestPasswordReset(email)` — public procedure, generates token, sends email, returns generic success (don't leak whether email exists)
- New route: `app/api/auth/reset-password/route.ts` — POST validates token, hashes new password, sets `User.password`, marks token `usedAt`, invalidates all sessions via `prisma.session.deleteMany({ where: { userId } })`
- New pages: `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`

**2.4 Login audit logging**
- In `auth.ts` `authorize()` callback: after success/failure determination, `prisma.loginAuditLog.create(...)` with outcome + email + ip (from request headers)
- Note: NextAuth Credentials authorize doesn't expose request object cleanly — use Next.js middleware to pass IP via header, or use `signIn` event callback
- `admin.listLoginHistory` tRPC procedure (managerProcedure) → paginated `LoginAuditLog` filtered by org's user emails
- UI: `app/org/[slug]/settings/security/page.tsx` — table of recent logins

---

### Phase 3 — Security & Performance (2–3 days)

Goal: Remove CSP unsafe-inline; distributed rate limiting; pagination.

**3.1 Nonce-based CSP**
- Move CSP out of `next.config.mjs` static headers
- In `middleware.ts`: generate `crypto.randomUUID()` nonce per request, set `x-nonce` response header
- In `app/layout.tsx` (server component): read `headers().get('x-nonce')`, pass to `<Script nonce>` and inline `<style nonce>` if any
- Update CSP value: replace `'unsafe-inline'` with `'nonce-{nonce}'`
- Add Stripe.js and any other CDN scripts to CSP `script-src`

**3.2 Upstash distributed rate limiting**
- `pnpm add @upstash/redis @upstash/ratelimit`
- `lib/ratelimit.ts`:
  ```ts
  export const loginRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "15m"),
    prefix: "rl:login",
  })
  export const registerRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1h"),
    prefix: "rl:register",
  })
  ```
- Replace in-process `Map`-based rate limiting in `middleware.ts` with Upstash calls
- Return 429 with `Retry-After` header on limit exceeded

**3.3 Pagination on all list endpoints**
- Cursor-based for `events.getAll` (large dataset)
- Offset-based for `musicians.getAll`, `hotels.getAll`, `admin.listUsers` (smaller, simpler)
- Input schema: `z.object({ limit: z.number().min(1).max(100).default(20), cursor: z.string().optional() })`
- Response: `{ items: T[], nextCursor: string | null, total: number }`
- Update all Effector models in `features/*/model.ts` to handle paginated responses

---

### Phase 4 — Testing & Ops (3–4 days)

Goal: API integration tests, S3 resilience, runbook, monitoring.

**4.1 API integration test setup**
- Add `vitest` integration test config (`vitest.integration.ts`) — separate from unit tests
- Test DB: use `DATABASE_URL` pointed at a test database (env var), run `prisma migrate reset` in setup
- Helper: `createTestContext(role, orgId)` — returns a tRPC caller with fake session
- Test files in `__tests__/api/`: `events.test.ts`, `musicians.test.ts`, `hotels.test.ts`, `billing.test.ts`, `organizations.test.ts`, `admin.test.ts`
- Each file covers: happy path, unauthorized (wrong role), wrong org (cross-tenant), not-found

**4.2 S3 retry logic**
- Wrap `PutObjectCommand` in `lib/s3.ts` with retry helper:
  ```ts
  async function uploadWithRetry(params, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try { return await s3.send(new PutObjectCommand(params)) }
      catch (e) {
        if (attempt === maxAttempts) { Sentry.captureException(e); throw e }
        await sleep(200 * 2 ** attempt) // 400ms, 800ms
      }
    }
  }
  ```
- Replace direct `s3.send(new PutObjectCommand(...))` calls with `uploadWithRetry`

**4.3 Production deployment runbook**
- File: `docs/runbook.md`
- Sections: Prerequisites, First deployment, Environment variables, Database migrations, Vercel project setup, Stripe webhook setup, Post-deploy verification checklist, Rollback procedure, Secret rotation

**4.4 Monitoring**
- Sentry already configured — increase tracing sample rate to 20% for launch period, reduce to 5% after stable
- Add Sentry custom tags: `org.id`, `org.slug`, `subscription.status` on all server requests
- Vercel Analytics: enable in `app/layout.tsx` (`<Analytics />` from `@vercel/analytics`)
- Vercel Speed Insights: add `<SpeedInsights />`
- Superadmin dashboard `app/superadmin/page.tsx`: add metrics query — active org count, trialing count, MRR estimate from Stripe

---

## File Map

```
lib/
  stripe.ts                     NEW — Stripe singleton
  email.ts                      NEW — Resend client + templates
  ratelimit.ts                  NEW — Upstash rate limit instances

server/routers/
  billing.ts                    NEW — Stripe billing procedures
  auth.ts                       MOD — add requestPasswordReset, resendVerification

app/
  api/webhooks/stripe/route.ts  NEW — Stripe webhook handler
  api/auth/verify-email/route.ts NEW
  api/auth/reset-password/route.ts NEW
  onboarding/
    plan/page.tsx               NEW — plan selector
    success/page.tsx            NEW — post-checkout
  auth/
    forgot-password/page.tsx    NEW
    reset-password/page.tsx     NEW
    pending/page.tsx            MOD — add resend button
  org/[slug]/settings/
    billing/page.tsx            NEW
    security/page.tsx           NEW — login audit log

prisma/
  schema.prisma                 MOD — Subscription, LoginAuditLog, PasswordResetToken, indexes
  migrations/...                NEW — per phase

middleware.ts                   MOD — CSP nonce, Upstash rate limiting, email-verified check
auth.ts                         MOD — unstable_update → update, login audit hook
next.config.mjs                 MOD — remove CSP from static headers

docs/
  runbook.md                    NEW

__tests__/api/                  NEW — integration test files
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| NextAuth stable has breaking changes from beta.31 | Read changelog before upgrading; run full test suite; check `unstable_update` → `update` and any adapter changes |
| Stripe webhook delivery delay causes user to see "pending" state | Post-Checkout page polls `getSubscription` for up to 30s, shows spinner |
| `Event.organizationId` backfill fails on prod data | Write migration carefully; preview count of null rows; test in staging first |
| CSP nonce breaks third-party scripts | Audit all `<Script>` tags; add CDN domains to script-src; test Stripe.js, Sentry, Vercel Analytics |
| Seat limit bypass via concurrent requests | Use DB transaction + row lock when counting seats in `createUser` |
| Resend deliverability (new domain) | Set up SPF/DKIM/DMARC on `RESEND_FROM_EMAIL` domain before launch |

---

## Out of Scope

- OAuth providers (Google, GitHub)
- 2FA / MFA
- GDPR data export / account deletion
- SOC 2
- Custom domains per org
- Usage-based metering
- Mobile app
- Reseller / white-label
