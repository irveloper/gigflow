# Spec: Complete org-owner onboarding & role guard hardening

**Branch:** `icaamal/feat-better-roles`  
**Date:** 2026-05-22  
**Feature name:** `if-this-feature-fix-is-ready`

---

## Overview

The "better-roles" branch introduced org-owner self-registration (sign up as Org Owner → choose plan → dashboard). The core happy path is in place and working. This spec covers the **remaining gaps** that prevent the feature from being production-ready:

1. An org owner who exits mid-onboarding and returns later has no path back to complete setup.
2. The success page after Stripe checkout may time out before the user's session reflects their new organization.
3. A musician or hotel user can bypass the role model by manually visiting the org-creation URL.
4. Musicians and hotels who verify their email but have no org land on broken pages when accessing the app directly.
5. The manager self-registration flow has no test coverage.

---

## Session Context

This spec was derived from the current conversation. Key decisions already made in this session:

- `manager` is the internal role name for "Org Owner" — no new role enum value needed.
- After email verification, managers are sent to `/onboarding/plan` (Stripe checkout + org creation combined), not the old `/org/new` free-tier path.
- Musicians and hotels who self-register and verify their email should see a clear "Account active, an admin will invite you" message — they do NOT create orgs.
- The `/org/new` route remains for internal/dev use but must be restricted to managers only.

---

## Research Summary

From `osddt.research.md`:

- **Happy path works:** register as Org Owner → email verify → choose plan → Stripe → success → dashboard. All pieces present.
- **Re-login gap (MEDIUM):** A manager who verifies email, logs out, and returns is not redirected back to pending/onboarding. They land on `/` with a dead end.
- **JWT staleness (MEDIUM):** The Stripe webhook updates the database but cannot refresh the session JWT. The success page polls a procedure that reads `organizationId` from the JWT — which is still null, causing polling failures until the session is manually refreshed.
- **`/org/new` role bypass (LOW):** Any authenticated user can hit `/org/new` directly and be upgraded to manager with a free org.
- **Member routes (LOW):** Musicians/hotels with no org who access `/`, `/calendar`, etc. directly see broken UI (no org context, no redirect to their appropriate pending state).

---

## Requirements

### 1. Org owner re-entry path
- When an org owner (role = manager, email verified, no organization) logs into the app — on any visit after the initial registration — the app must guide them back to complete their setup.
- The user must not be silently dropped on the home page with no action available.

### 2. Post-checkout session continuity
- After Stripe checkout completes and the user lands on the success page, the app must correctly detect when the organization is ready and navigate the user to their dashboard.
- The success page must not time out or show an error simply because the session has not yet reflected the new organization — it should resolve the session before declaring failure.

### 3. Org creation restricted to org owners
- Only users with the Org Owner role may create an organization.
- A musician or hotel user who navigates directly to the org creation URL must be refused and redirected appropriately — they must not be silently upgraded to a different role.

### 4. Member users (musician/hotel) with no org
- A musician or hotel user who has verified their email but has not yet been added to an organization must not see broken or empty app pages when accessing the app.
- They must be shown a clear message explaining their status and what they are waiting for.

### 5. Test coverage for org-owner registration
- The system's test suite must include scenarios for: a manager successfully registering, and a manager who logs back in before completing org setup being redirected to continue onboarding.

---

## Scope

### In scope
- Guard that routes an org-owner-without-org back to the onboarding flow on login
- Session refresh step before polling on the success page
- Role check on the org-creation server action
- Redirect for musician/hotel users who access protected routes without an org
- Spec scenarios and tests for manager registration and re-login

### Out of scope
- Changes to the Stripe Checkout flow or pricing
- Any changes to what plans are available
- Musician/hotel invitation and org-join flows (separate feature)
- Superadmin role management
- The existing `/org/new` free-tier path (retains functionality, just gets a role guard)

---

## Acceptance Criteria

### AC-1: Org owner re-entry
- Given a user with role = Org Owner, email verified, and no organization
- When they log in (or return to the app on a later visit)
- Then they are redirected to the onboarding pending page which prompts them to choose a plan
- And they are not deposited on the home or calendar page with no action available

### AC-2: Success page resolves after checkout
- Given a user who has just completed Stripe checkout
- When they land on the onboarding success page
- Then the page refreshes the session before beginning to poll for subscription readiness
- And the dashboard opens correctly once the subscription is active
- And the page does not show a timeout error due to a stale session JWT

### AC-3: Org creation blocked for non-owners
- Given a user with role = musician or hotel
- When they navigate directly to the org creation URL
- Then the request is refused (they are redirected, not granted org creation)
- And their role is not changed

### AC-4: Member users without org see pending state
- Given a user with role = musician or hotel, email verified, no org
- When they navigate to any protected app route (home, calendar, profile, etc.)
- Then they are redirected to a page that clearly explains they are waiting to be added to an organization
- And they are not shown a broken or empty application UI

### AC-5: Manager registration test coverage
- Given the `auth.scenarios.ts` spec file
- Then it includes a scenario: "org owner registers with manager role and receives verification email"
- And a scenario: "org owner with verified email and no org is redirected to onboarding on login"
- And the corresponding test file passes

---

## Decisions

1. **Re-login guard placement**: Middleware (server-side) — catches the manager-with-no-org state on every request before the page renders.
2. **Session refresh on success page**: Call NextAuth `update()` explicitly before the first poll to guarantee a fresh JWT with the new `organizationId`.
3. **Musician/hotel without org redirect target**: Dedicated `/account/pending-org` route — separate from the onboarding pending flow, with space to clearly explain the waiting state.
