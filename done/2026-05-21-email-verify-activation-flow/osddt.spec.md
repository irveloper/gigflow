# Spec: Email Verification Activation Flow

## Overview

New admin users (hotel/org owners) who register go through three steps before they can use the platform: verify their email, create their organization, and enter the dashboard. Currently, clicking the verification link dumps the user back at the login page, and logging in still shows the "account pending" error screen. Only a second manual logout + login cycle resolves it. This wastes trust at the most critical moment of onboarding and makes the product feel broken.

This feature makes the full activation path seamless and self-explanatory:

```
Register → "check your inbox" → click link → "create your org" → dashboard
```

---

## Requirements

### R1 — Email verification resolves without a second login

When a logged-in user clicks their verification link, the system must recognize their active session, mark the email as verified, and redirect them directly to the org-creation step — no login prompt, no re-authentication required.

### R2 — Email verification works for users who are not logged in

When a user clicks the verification link in a different browser, or after their session has expired, the system must redirect them to login. After successful login, they must land on the org-creation step (not the "check your inbox" screen).

### R3 — Pending page shows distinct, accurate state

The "pending" screen must accurately reflect where the user actually is:

| User state | Screen shown |
|---|---|
| Registered, email **not** verified | "Check your inbox" + resend button |
| Email **verified**, no org yet | "Create your organization" form/button |
| Email verified, org exists | Redirect to `/org/{slug}` dashboard |

A user who bookmarks `/auth/pending?verify=1` after already verifying must not see the "check your inbox" message — they must be routed to whichever state they are actually in.

### R4 — "Create organization" step is only available to verified users

The org-creation page must not be reachable by users whose email is not verified. Attempting to access it while unverified redirects to the "check your inbox" screen.

### R5 — Progress is communicated clearly at each step

Each screen in the activation flow must tell the user where they are and what comes next:
- "Check your inbox" screen: show step indicator (1 of 3 — verify email)
- "Create your org" screen: show step indicator (2 of 3 — name your organization)
- After org creation, the user lands on the dashboard with no further gates (step 3 of 3 complete)

### R6 — Re-sending the verification email works from the pending screen

A user on the "check your inbox" screen must be able to request a new verification email if the original expired or was lost. The resend action must be rate-limited and show appropriate feedback (success / already verified / too many attempts).

---

## Scope

### In scope

- Fix the broken flow where a verified user is still shown the "pending" error after login
- Detect session presence when the verification link is clicked and route accordingly (R1, R2)
- Split the pending page into two clear states (R3)
- Guard org creation behind email verification (R4)
- Step indicators on each activation screen (R5)
- Resend email from pending screen (R6, already partially implemented)
- Update auth spec scenarios to cover the new flow end-to-end

### Out of scope

- Changing how musicians/staff accept invitations (invite acceptance sets `emailVerified` automatically and bypasses this flow entirely — no change to that path)
- Password reset flow
- Social / OAuth login
- Admin-side user management

---

## Acceptance Criteria

**AC-1: Seamless verify when logged in**
Given a registered admin user who is logged in and on `/auth/pending?verify=1`,
when they click the verification link in their email,
then they are redirected to the org-creation step without being shown a login form.

**AC-2: Graceful verify when logged out**
Given a registered admin user whose session has expired (or who opened the link in a new browser),
when they click the verification link and then log in with their credentials,
then they land on the org-creation step, not the "check your inbox" screen.

**AC-3: Wrong screen never shown**
Given a user who has already verified their email,
when they visit `/auth/pending?verify=1` (e.g. bookmarked URL),
then they are redirected to the org-creation step (if no org) or `/org/{slug}` (if org exists) — never shown "check your inbox".

**AC-4: Org creation blocked without verification**
Given an unverified user who navigates directly to `/org/new`,
then they are redirected to `/auth/pending?verify=1`.

**AC-5: Full happy-path works end-to-end**
Given a brand-new admin user,
when they complete registration → click verification email → fill in org name → submit,
then they arrive on the `/org/{slug}` dashboard in a single uninterrupted flow with no unexpected screens.

**AC-6: Step indicators visible**
Given any user on the "check your inbox" or "create your org" screen,
then they can see which step they are on (e.g. "Step 1 of 3" or equivalent).

**AC-7: Resend email works**
Given a user on the "check your inbox" screen,
when they click "Resend verification email",
then they receive a new email (if within rate limit) and the UI confirms it was sent.

**AC-8: No regression on invite flow**
Given a musician who accepts an invitation,
then their flow is unaffected — they do not see verification or org-creation screens.

---

## Research Summary

From `osddt.research.md`:

- **Session bug**: The `emailVerified` field is stored as a `boolean` in the JWT but cast to NextAuth's native `Date | null` type at the session boundary using a double `as unknown as` cast. This corrupts the value after a fresh login, making the middleware's `=== false` check see a falsified state — so even verified users hit the pending screen. The second login works because no stale token is present.
- **Cookie clearing**: The verification route intentionally clears auth cookies to force a fresh JWT. This is what produces the "you must log in again" experience. It can be replaced or augmented with an in-place session update when the user is already logged in.
- **Pending page dual-mode**: The current `/auth/pending` component uses a `verify=1` query param to switch between two entirely different messages, but has no runtime check against the user's actual verification state — meaning the wrong state can be shown.
- **`unstable_update()`**: Already used in the org-creation action to refresh the JWT with org info. The same mechanism can push a `emailVerified: true` update to the session immediately after verification.

---

## Session Context

From the user's description:

- The user registered as a hotel admin and went through the full broken flow personally.
- The desired end state is: click the verification email link → see "create your organization" → enter the dashboard. No extra login, no confusing dead ends.
- The invite-acceptance path (musicians) must not be disrupted.

---

## Decisions

1. **Musician edge case**: `/org/new` is admin-only. Musicians only view organizations they belong to — they never reach the org-creation route, so no explicit guard exemption is needed for them.

2. **Step indicator design**: Horizontal step stepper (breadcrumb-style) — all three steps labeled inline, current step highlighted, completed steps marked with a checkmark. Gives users the clearest view of where they are and what remains.
