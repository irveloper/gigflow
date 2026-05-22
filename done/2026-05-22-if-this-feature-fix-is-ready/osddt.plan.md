# Plan: Complete org-owner onboarding & role guard hardening

**Branch:** `icaamal/feat-better-roles`  
**Date:** 2026-05-22  
**Stack:** Next.js 15, NextAuth v5 (auth.js), tRPC, Prisma, Stripe webhooks, Vitest + Effector fork

---

## Architecture Overview

Five targeted changes to close the gaps identified in the spec. No new DB schema, no new tRPC procedures, no new dependencies.

- **Middleware** (`src/middleware.ts`) — single place to enforce two new session-state guards after the existing email-verification check. Already calls `auth()` in that block; the new checks reuse that session read.
- **Success page** (`src/app/onboarding/success/page.tsx`) — add `useSession().update()` call before the first poll to flush the stale JWT.
- **Server action** (`src/app/org/new/actions.ts`) — one-line role check before any DB write.
- **New page** (`src/app/account/pending-org/page.tsx`) — static "waiting for invite" screen for member users; reuses existing `ActivationStepper` component.
- **Spec + tests** — two new scenarios in `auth.scenarios.ts`, two new test cases in `auth.test.ts`.

All changes are additive or minimal edits to existing files. No regressions to the happy path.

---

## Implementation Phases

### Phase 1 — Middleware guards
**Files:** `src/middleware.ts`  
**Goal:** Two new guards inside the existing `if (isAuthenticated && isProtectedRoute)` block, after the email-verification check.

**Guard A — manager re-login (AC-1):**
- Condition: `session.user.role === "manager"` AND `session.user.emailVerified === true` AND `!session.user.organizationId`
- Skip when: `pathname.startsWith("/auth/")` OR `pathname.startsWith("/onboarding/")` OR `pathname.startsWith("/api/")`
- Action: `redirect("/auth/pending")`

**Guard B — member without org (AC-4):**
- Condition: `(role === "musician" || role === "hotel")` AND `session.user.emailVerified === true` AND `!session.user.organizationId`
- Skip when: `pathname.startsWith("/account/pending-org")` OR `pathname.startsWith("/auth/")` OR `pathname.startsWith("/api/")`
- Action: `redirect("/account/pending-org")`

Add `/account` to the `PROTECTED_ROUTES` array so the new page requires auth.

Implementation note: both guards sit inside the existing `const session = await auth()` block — no extra session reads.

---

### Phase 2 — Session refresh on success page
**File:** `src/app/onboarding/success/page.tsx`  
**Goal:** Force JWT refresh before the first subscription poll (AC-2).

**Changes:**
- Import `useSession` from `next-auth/react`
- Destructure `update` from `useSession()`
- In the `useEffect`, call `await update()` as the first step before scheduling the first poll
- The existing poll logic (`getSubscription` via `orgProcedure`) runs after the refresh, so `ctx.organizationId` will reflect the webhook-updated value

```
useEffect(() => {
  if (!slug) { router.replace("/"); return }
  update().then(() => { setTimeout(poll, POLL_INTERVAL_MS) })
}, [slug, router])
```

Note: `update` from `useSession` is stable across renders — safe to include in the dependency array or exclude with a ref pattern.

---

### Phase 3 — Role guard on org creation server action
**File:** `src/app/org/new/actions.ts`  
**Goal:** Prevent non-manager users from creating an org via direct URL (AC-3).

**Change:** After the existing `if (!session?.user?.id) throw new Error("Unauthorized")` check, add:

```typescript
if (session.user.role !== "manager") {
  throw new Error("Unauthorized")
}
```

This is the minimal fix. The error is caught by the form's `catch` block in `/org/new/page.tsx` and shown as an inline error message.

---

### Phase 4 — New `/account/pending-org` page
**File:** `src/app/account/pending-org/page.tsx` (new file)  
**Goal:** Clear "waiting for org invite" screen for musician/hotel users (AC-4).

**Page behaviour:**
- Server component (reads session) or client component using `useSession`
- Shows `ActivationStepper` with `variant="member"` at `currentStep={2}`
- Card: "Account active" heading, description explains they'll receive access once an org admin adds them
- Sign out button (same pattern as pending page)
- No org-creation buttons, no navigation to onboarding

**Session handling:** If user somehow has an `organizationSlug` already (e.g. added while viewing this page), redirect to `/org/{slug}`.

---

### Phase 5 — Spec scenarios and tests
**Files:** `src/specs/features/auth.scenarios.ts`, `src/__tests__/features/auth.test.ts`  
**Goal:** Cover the manager registration and re-login paths in the test suite (AC-5).

**New scenario in `auth.scenarios.ts` → `register` group:**
```
"new org owner registers with manager role": {
  given: { email, password, name, role: "manager" },
  when: "registerSubmitted is triggered",
  then: ["registerFx succeeds", "$user is set with role manager", "auth cookie is set"],
}
```

**New scenario in `auth.scenarios.ts` → `emailVerification` group:**
```
"manager with verified email and no org is redirected to /auth/pending": {
  given: { session: { role: "manager", emailVerified: true, organizationId: undefined } },
  when: "user navigates to any protected route",
  then: [
    "middleware redirects to /auth/pending",
    "user sees the Choose-a-plan mode (not check-inbox mode)",
  ],
}
```

**New test in `auth.test.ts` → `register` describe:**
- Fork with `registerFx` handler returning a manager user fixture
- Trigger `registerSubmitted` with `role: "manager"`
- Assert `$user.role === "manager"` and `$authError === null`

**New test in `auth.test.ts` → `emailVerification` describe:**
- Fork with `checkAuthFx` handler returning `userFixtures.verifiedNoOrg` (role=manager, no orgId)
- Trigger `checkAuth`
- Assert `$user.role === "manager"` and `$user.organizationSlug === undefined`
- (The middleware redirect itself is documented in the scenario — unit test covers the model state)

**Existing fixture used:** `userFixtures.verifiedNoOrg` (already has `role: "manager"`, no `organizationId`) — no fixture changes needed.

---

## Technical Dependencies

| Dependency | Already present? | Notes |
|---|---|---|
| `useSession` from `next-auth/react` | Yes | Used in pending page; import `update` from it |
| `ActivationStepper` component | Yes | `variant="member"` already implemented |
| `auth()` in middleware | Yes | Used by email-verification guard; reuse for new guards |
| Effector `fork` + vitest | Yes | Test pattern consistent with existing auth tests |

No new packages required.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `update()` call on success page triggers an extra network round-trip on every page load | Low — only on success page | Acceptable: this page is visited once per onboarding and `update()` is a lightweight JWT refresh |
| Middleware `auth()` read adds latency to every protected request | Low — already called for email check; guards share the read | No additional `auth()` call — guards are added inside the existing conditional block |
| New `/account/pending-org` route not in `PROTECTED_ROUTES` — accessible without auth | Possible if forgot | Add `/account` to `PROTECTED_ROUTES` in Phase 1 |
| `createOrgAction` error message exposed to client reveals role check | Very low | Generic "Unauthorized" string, not a security leak |
| Manager guard in middleware redirects to `/auth/pending` which could show the wrong pending-page branch if session state is stale | Low — `pending/page.tsx` reads session directly | Already handled: pending page derives its branch from `session.user.role` at render time |

---

## File Change Summary

| File | Type | Change |
|---|---|---|
| `src/middleware.ts` | Edit | Add Guard A (manager re-login) + Guard B (member no-org) + add `/account` to `PROTECTED_ROUTES` |
| `src/app/onboarding/success/page.tsx` | Edit | Add `useSession` import, call `update()` before first poll |
| `src/app/org/new/actions.ts` | Edit | Add role check after session auth check |
| `src/app/account/pending-org/page.tsx` | New | Member pending-org screen |
| `src/specs/features/auth.scenarios.ts` | Edit | 2 new scenarios |
| `src/__tests__/features/auth.test.ts` | Edit | 2 new test cases |

---

## Out of Scope

- Stripe Checkout flow or pricing changes
- Musician/hotel invitation and org-join flows
- Superadmin role management
- `/org/new` free-tier path behaviour beyond the role guard
- UI redesign of any existing page
