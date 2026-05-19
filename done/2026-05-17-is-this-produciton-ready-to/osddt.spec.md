# Spec: Production Readiness & Monetization for Music Event Platform SaaS

**Feature name:** `is-this-produciton-ready-to`
**Date:** 2026-05-16
**Status:** Draft

---

## Overview

The music event platform is a multi-tenant SaaS for event managers, musicians, and hotels. Organizations manage events, assign musicians and hotels, and handle check-ins. The platform has a solid architectural foundation — multi-tenancy, role-based access, tRPC API, and Effector state management — but is not yet ready to charge customers.

This spec defines what must be true before the platform can accept paying customers. It covers two phases:

- **Phase 1 (Launch-blocking):** Features without which revenue collection is impossible or the product is unsafe.
- **Phase 2 (Pre-scale):** Features required before the platform can handle growth without operator intervention.

---

## Research Summary

From `osddt.research.md`:

- **Architecture is sound.** Multi-tenancy, FSD structure, role-based procedures, and org isolation are all well-implemented. The foundation can support a paid product.
- **Payment is entirely absent.** No Stripe, no subscription, no billing. Anyone can create an org for free. This is the primary monetization blocker.
- **NextAuth is on beta.31.** The entire auth system depends on an unstable pre-release. A breaking change upstream could require emergency migration.
- **Tests cover client-side Effector logic only.** tRPC routes have zero integration test coverage — broken API endpoints will not be caught.
- **Org data isolation is application-only.** There are no database-level constraints preventing cross-tenant data leakage if a query bug is introduced.
- **Critical security gap:** CSP has `unsafe-inline`, no email verification, no login audit trail.

---

## Requirements

### Phase 1 — Launch-Blocking

#### P1.1 — Subscription & Payment Gate
- An organization cannot be created or activated without completing a payment flow.
- The platform must support at least one subscription tier (monthly or annual billing).
- When a subscription lapses or payment fails, the organization's access to the platform is suspended (read-only or locked, not deleted).
- Organization owners can view their current plan, billing cycle, and payment history.
- Organization owners can cancel their subscription; access continues until the end of the billing period.

#### P1.2 — Email Verification
- A newly registered user cannot access the platform until they verify their email address.
- The system sends a verification email on registration.
- Users who have not verified are redirected to a verification-pending page with an option to resend the email.

#### P1.3 — Password Reset
- A user who has lost their password can request a reset link via their email address.
- The reset link expires after a defined period.
- After a successful reset, all existing sessions for that user are invalidated.

#### P1.4 — Login Audit Logging
- Every login attempt (success and failure) is recorded with: user identifier, timestamp, outcome, and IP address.
- Organization admins can view the login history for their org's users.
- This log is append-only and cannot be edited by any user role.

#### P1.5 — API Pagination
- All list endpoints (users, events, musicians, hotels) return paginated results.
- Clients can specify page size and cursor/offset.
- Responses include total count and next-page indicator.

#### P1.6 — Query Performance: Organization Isolation
- All queries that filter by organization must perform at database scale (10,000+ rows) without full table scans.
- Event and other entity queries scoped to an org must complete within 200ms at p99 under normal load.

#### P1.7 — Security: Content Security Policy
- The application must not use `unsafe-inline` in its Content Security Policy.
- Inline scripts and styles must be replaced with nonce-based or hash-based CSP.

### Phase 2 — Pre-Scale

#### P2.1 — API Integration Tests
- Every tRPC route has at least one integration test that runs against the actual database (not mocks).
- Tests cover: happy path, authorization rejection (wrong role, wrong org), and not-found cases.
- These tests run in CI on every PR.

#### P2.2 — Distributed Rate Limiting
- Login and registration rate limits persist across server restarts and work in multi-region deployments.
- Rate limit state is not lost on cold starts.

#### P2.3 — Error Recovery for External Services
- Failed S3 uploads are retried up to 3 times with exponential backoff before returning an error to the user.
- Failed S3 operations are reported to the error monitoring system.

#### P2.4 — Production Deployment Runbook
- A documented, step-by-step process exists for: first-time deployment, environment variable setup, database migration, and rollback.
- The runbook covers what to do when: the database migration fails, a deployment is broken, and secrets need rotation.

#### P2.5 — Monitoring & Alerting
- The operator can see: error rate, p99 API latency, and active organization count on a single dashboard.
- Alerts fire when: error rate exceeds 1% over 5 minutes, or p99 latency exceeds 2 seconds.

---

## Scope

### In Scope
- Stripe-based subscription billing (one or more tiers)
- Email verification and password reset flows
- Login audit log (read by org admins)
- Pagination on all list APIs
- Database query optimization for org-scoped queries
- Nonce-based CSP
- API integration tests for all tRPC routes
- Distributed rate limiting
- S3 retry logic
- Production deployment runbook
- Basic ops dashboard (error rate, latency, org count)

### Out of Scope
- OAuth login (Google, GitHub, etc.)
- Two-factor authentication (2FA / MFA)
- GDPR data export / right-to-erasure tooling
- SOC 2 compliance
- Custom domain support per organization
- Usage-based metering
- Reseller / white-label support
- Mobile app

---

## Acceptance Criteria

### Billing
- [ ] Creating an organization without a valid payment method returns an error.
- [ ] After payment is confirmed, the organization is activated and accessible.
- [ ] When a subscription is cancelled, the org remains accessible until the billing period ends, then is suspended.
- [ ] An org owner can view invoices and change their plan from within the app.

### Email Verification
- [ ] A user who registers but has not verified their email is blocked from accessing the dashboard.
- [ ] Clicking the verification link in the email activates the account.
- [ ] A resend verification link button is available on the pending page.

### Password Reset
- [ ] A user can request a password reset from the login page without being logged in.
- [ ] The reset link works exactly once and expires after a defined period.
- [ ] After reset, logging in with the old password fails.

### Security
- [ ] The application's CSP header contains no `unsafe-inline` directive.
- [ ] Login attempts exceeding the rate limit are rejected in a multi-region deployment without resetting after a cold start.

### Performance
- [ ] `events.getAll` for an org with 10,000 events returns in under 200ms in a production-like environment.

### Tests
- [ ] `pnpm test:run` passes with zero failures on the main branch.
- [ ] Every tRPC router has integration tests covering happy path and authorization rejection.

### Ops
- [ ] A new engineer can deploy the app to a fresh environment by following the runbook alone, with no additional guidance.
- [ ] An S3 upload that fails transiently is retried and succeeds without the user seeing an error.

---

## Decisions

1. **Monetization model**: Tiered per-org subscription with seat caps. Example tiers: Basic (3 seats), Mid (10 seats), higher tiers scale up. Pricing to be defined at plan phase.
2. **Buyer persona**: Org owners pay. Musicians and hotels are members/resources within an org — not separate billing entities.
3. **Trial strategy**: 7-day free trial, credit card required at signup. At expiry, org is suspended until payment confirmed.
4. **Compliance scope**: No GDPR or SOC 2 required (Mexico-based, no EU/US enterprise target at launch). Out of scope.
5. **Deployment target**: Vercel. Rate limiting infrastructure must work across Vercel multi-region (Upstash Redis).
6. **NextAuth beta dependency**: Migrate to stable before launch. 1–2 days of work, prevents surprise breakage in production.
