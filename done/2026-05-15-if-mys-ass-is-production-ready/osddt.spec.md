# Spec: Production Hardening Round 2

## Overview

The app (PlugIn Cancún — music event platform) completed a first round of production hardening on 2026-05-09. All 7 phases of that sprint shipped. The platform is largely production-capable, but a second audit (2026-05-15) identified 2 correctness bugs and 3 remaining security/launch gaps that block a credible public deployment.

This spec covers the items needed to go from "mostly prod-ready" to "safe to launch publicly."

---

## Research Summary

From `osddt.research.md` (2026-05-15 audit):

- **All prior sprint tasks confirmed complete**: middleware guard active, TypeScript strict, 53/53 tests pass, Sentry wired, rate limiting in place, admin user management built.
- **`isActive` flag silently broken**: admins can deactivate users via the admin panel, but deactivated users can still log in. The deactivation feature was built but the login path ignores it.
- **Check-in feature is non-functional**: the UI exists and is navigable, but the backend always returns mock data and fake storage URLs. No check-in data ever reaches the database.
- **No Content-Security-Policy**: the only remaining missing security header. XSS attacks can bypass all other protections without it.
- **Demo credentials visible in prod**: the login page hard-shows demo account emails and passwords with no environment gate. Shipping this to production is embarrassing at best, a liability at worst.
- **`BACKEND.md` describes Supabase** (the previous backend) but the app runs on Prisma + NextAuth. Misleads new developers.
- **No CI pipeline**: no automated test or build gate on commits/PRs.

---

## Requirements

### R1 — Deactivated users cannot log in

When an admin deactivates a user account, that user's credentials must be rejected at login. The rejection must be indistinguishable from a wrong-password error — no message reveals that the account exists or is deactivated.

### R2 — Check-in writes to the database

When a musician submits a check-in (with optional photo, location, and comments), the check-in data must be persisted. The event's status and `checkedIn` flag must update in the database. A manager must be able to see the check-in record afterward.

### R3 — Check-in photo upload must work

When a musician attaches a photo during check-in, the photo must be stored in a real location (not `https://mock-storage.local/...`). The stored URL must be retrievable and non-expiring (or long-lived enough for managerial review).

### R4 — Demo credentials are hidden in production

On a production deployment (`NODE_ENV=production`), the "Demo Accounts" section on the login page must not be visible. Demo accounts may remain in the database for seeding/testing, but their credentials must not be displayed to users in prod.

### R5 — Content-Security-Policy header is set

All HTTP responses must include a `Content-Security-Policy` header that restricts script, style, and resource origins to the application's own domain and known trusted sources (Sentry reporting endpoint). An invalid or blocked resource must not silently fail — violations should be reported.

### R6 — `BACKEND.md` reflects the actual backend

The project documentation must accurately describe how the backend works (Prisma, NextAuth, PostgreSQL via Docker, tRPC). A developer reading `BACKEND.md` should be able to set up and run the project without misleading steps.

### R7 — CI pipeline runs on every push

A CI job must automatically run `pnpm test:run` and `pnpm build` on every push to `main` and on every pull request. A failing test or build must block merge.

---

## Scope

### In scope

- Fix deactivated-user login bypass (R1)
- Wire check-in to real Prisma mutations + file storage (R2, R3)
- Gate demo credentials behind `NODE_ENV` (R4)
- Add CSP header (R5)
- Rewrite `BACKEND.md` (R6)
- GitHub Actions CI pipeline (R7)

### Out of scope

- Changing the check-in UI/UX design
- Real-time (WebSocket) notifications for check-in events
- New admin features beyond what's already built
- Email notifications on check-in
- OAuth providers (Google, GitHub login)
- Changing the bcrypt cost factor (currently 12 — acceptable risk on Vercel Pro)
- Fixing the in-process rate limiter for multi-instance deployments (documented known limitation)
- Adding a health check endpoint

---

## Acceptance Criteria

### AC1 — Deactivated user blocked at login
- **Given** a user whose `isActive` is `false`
- **When** they attempt to log in with correct credentials
- **Then** login is rejected and the UI shows the same generic "invalid credentials" error (no distinction from wrong password)

### AC2 — Check-in persists to DB
- **Given** a musician on an event's check-in page
- **When** they submit the check-in form (with or without photo)
- **Then** the event's `checkedIn` field is `true` and `checkInTime` is set in the database
- **And** a manager can see the check-in timestamp and comments when viewing the event

### AC3 — Check-in photo stored and retrievable
- **Given** a musician attaches a photo on check-in
- **When** check-in is submitted
- **Then** the photo is stored in a real storage location
- **And** the `checkInPhoto` field on the event row contains a URL that resolves to the actual image

### AC4 — Demo accounts hidden in production
- **Given** the app is running with `NODE_ENV=production`
- **When** a user visits `/auth/login`
- **Then** the "Demo Accounts" card is not rendered
- **And** no demo email or password is visible in the page source

### AC5 — CSP header present and enforcing
- **Given** any page request to the application
- **When** the response is received
- **Then** the `Content-Security-Policy` header is present (enforcing, not report-only)
- **And** the policy allows the application's own scripts and styles
- **And** violations are reported to Sentry or a configured endpoint

### AC6 — BACKEND.md accurate
- **Given** a new developer reading `BACKEND.md`
- **When** they follow the setup instructions
- **Then** they can start a local Postgres instance with Docker, run migrations, seed data, and start the app — with no Supabase CLI required

### AC7 — CI passes on clean code
- **Given** a push to `main` or a pull request
- **When** the CI job runs
- **Then** `pnpm test:run` and `pnpm build` both complete successfully
- **And** a failing test or type error blocks merge

---

## Decisions

1. **Check-in photo storage**: AWS S3.
2. **CSP enforcement mode**: Enforcing `Content-Security-Policy` from day 1 (not report-only).
3. **Deactivated user error message**: Generic "invalid credentials" — same as wrong password, no account existence revealed.
