# Tasks: Complete org-owner onboarding & role guard hardening

**Branch:** `icaamal/feat-better-roles`  
**Date:** 2026-05-22

---

## Phase 1 — Middleware guards

> **Depends on:** nothing  
> **Definition of Done:** A manager with `emailVerified=true` and no org hitting any protected route lands on `/auth/pending`. A musician/hotel with `emailVerified=true` and no org hitting any protected route lands on `/account/pending-org`. Neither causes a redirect loop. `/account` routes require auth.

- [x] [S] Add `/account` to `PROTECTED_ROUTES` array in `src/middleware.ts`
- [x] [M] Add Guard A inside the existing `auth()` block: `role === "manager" && emailVerified && !organizationId` → redirect `/auth/pending` (skip paths: `/auth/`, `/onboarding/`, `/api/`)
- [x] [M] Add Guard B inside the existing `auth()` block: `role === "musician"|"hotel" && emailVerified && !organizationId` → redirect `/account/pending-org` (skip paths: `/account/pending-org`, `/auth/`, `/api/`)

---

## Phase 2 — Session refresh on success page

> **Depends on:** nothing (independent of Phase 1)  
> **Definition of Done:** Landing on `/onboarding/success` after Stripe checkout triggers a JWT refresh before the first `getSubscription` poll. The poll does not throw "No organization context" on the first attempt.

- [x] [S] Import `useSession` from `next-auth/react` in `src/app/onboarding/success/page.tsx`
- [x] [S] Destructure `update` from `useSession()` in the component
- [x] [S] In the `useEffect`, replace `setTimeout(poll, POLL_INTERVAL_MS)` with `update().then(() => setTimeout(poll, POLL_INTERVAL_MS))`

---

## Phase 3 — Role guard on org creation action

> **Depends on:** nothing (independent)  
> **Definition of Done:** Calling `createOrgAction` as a musician or hotel throws `"Unauthorized"` and no DB writes occur. Manager role is unaffected.

- [x] [S] In `src/app/org/new/actions.ts`, add role check after the existing session-id check: `if (session.user.role !== "manager") throw new Error("Unauthorized")`

---

## Phase 4 — New `/account/pending-org` page

> **Depends on:** Phase 1 (middleware must redirect members here; page should exist before guard is live)  
> **Definition of Done:** A musician/hotel user redirected to `/account/pending-org` sees a clear "Account active, waiting for org invite" message with the 2-step stepper at step 2. If they already have an org (added mid-session), they are redirected to their dashboard. Sign-out works.

- [x] [M] Create `src/app/account/pending-org/page.tsx` as a client component using `useSession`
- [x] [S] Redirect to `/org/{slug}` if `session.user.organizationSlug` is set (org was added while viewing page)
- [x] [S] Render `ActivationStepper` with `variant="member"` and `currentStep={2}`
- [x] [S] Render card: "Account active" title, description explaining org-invite waiting state, sign-out button

---

## Phase 5 — Spec scenarios and tests

> **Depends on:** Phases 1–4 complete (tests should reflect final behaviour)  
> **Definition of Done:** `pnpm test:run` passes with 2 additional test cases. Scenarios exist in `auth.scenarios.ts` for manager registration and manager re-login-with-no-org.

- [x] [S] Add scenario `"new org owner registers with manager role"` to `register` group in `src/specs/features/auth.scenarios.ts`
- [x] [S] Add scenario `"manager with verified email and no org is redirected to /auth/pending"` to `emailVerification` group in `src/specs/features/auth.scenarios.ts`
- [x] [M] Add test `"new org owner registers with manager role"` to `register` describe in `src/__tests__/features/auth.test.ts` — fork with `registerFx` returning manager fixture, assert `$user.role === "manager"` and `$authError === null`
- [x] [M] Add test `"manager with verified email and no org has no organizationSlug after checkAuth"` to `emailVerification` describe in `src/__tests__/features/auth.test.ts` — fork with `checkAuthFx` returning `userFixtures.verifiedNoOrg`, assert `$user.role === "manager"` and `$user.organizationSlug === undefined`
- [x] [S] Run `pnpm test:run` and confirm all tests pass

---

## Dependencies

```
Phase 3 ──────────────────────────────────────┐
Phase 2 ──────────────────────────────────────┤
Phase 1 ──► Phase 4 ──────────────────────────┤
                                               ▼
                                          Phase 5
```

Phases 1, 2, and 3 are independent of each other and can be implemented in any order. Phase 4 should come after Phase 1 (the route needs to exist before the middleware redirects to it). Phase 5 comes last.

---

## Complexity Summary

| Phase | Tasks | Total effort |
|---|---|---|
| 1 — Middleware guards | 3 tasks (S, M, M) | Medium |
| 2 — Session refresh | 3 tasks (S, S, S) | Small |
| 3 — Role guard | 1 task (S) | Small |
| 4 — Pending-org page | 4 tasks (M, S, S, S) | Medium |
| 5 — Spec + tests | 5 tasks (S, S, M, M, S) | Medium |
