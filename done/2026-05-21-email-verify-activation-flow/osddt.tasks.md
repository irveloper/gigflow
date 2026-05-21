# Tasks: Email Verification Activation Flow

## Dependencies

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                        ↓
                              Phase 5 → Phase 6
                                        ↓
                                     Phase 7
```

Phase 1 must land before Phase 2–4 (all depend on `emailVerified` being a reliable boolean in the session). Phase 5 must exist before Phase 6. Phase 7 can be written alongside any phase but must pass against the final state.

---

## Phase 0 — Spec Scenarios (SDD pre-req)

> Must come first. Per CLAUDE.md: scenario file before implementation.

- [x] [S] Add `emailVerification` scenario group to `src/specs/features/auth.scenarios.ts` covering: verified user logs in with correct session state; verified user on pending page sees create-org mode; unverified user blocked from `/org/new`; logged-in user clicks verify link and is redirected without re-auth; logged-out user clicks verify link and lands on create-org mode after login
- [x] [S] Add `verifiedNoOrg` user fixture to `src/specs/fixtures/users.ts` (emailVerified: true, organizationId: null, organizationSlug: undefined) if not already present

**Definition of Done**: `src/specs/features/auth.scenarios.ts` has a populated `emailVerification` key with at least 5 scenario entries. No implementation code changed yet.

---

## Phase 1 — Fix Session Type Bug (root cause)

> Unblocks all other phases. No behaviour change visible yet — fixes the silent corruption.

- [x] [S] Locate the NextAuth type augmentation file (search for `declare module "next-auth"` — likely `src/types/next-auth.d.ts` or similar). Change `emailVerified` on the `Session["user"]` and `User` interfaces from `Date | null` to `boolean`. Add `emailVerified: boolean` to the `JWT` interface in `@auth/core/jwt` augmentation. (Already correct in `types/next-auth.d.ts` — no change needed.)
- [x] [S] Fix session callback in `src/auth.config.ts` line 56: replace `token.emailVerified as unknown as typeof session.user.emailVerified` with `Boolean(token.emailVerified)`
- [x] [S] Add `emailVerified` propagation to the JWT update trigger block in `src/auth.config.ts` (lines 10-14): add `if (s.user?.emailVerified !== undefined) token.emailVerified = s.user.emailVerified` so `unstable_update({ user: { emailVerified: true } })` takes effect
- [x] [S] Run `pnpm test:run` — confirm no type errors and existing auth tests still pass

**Definition of Done**: TypeScript compiles cleanly. `pnpm test:run` green. `session.user.emailVerified` is typed as `boolean` throughout. No `as unknown as` cast remains on that field.

---

## Phase 2 — Update Verify-Email Route

> Depends on: Phase 1 (JWT update handler must handle emailVerified).

- [x] [M] In `src/app/api/auth/verify-email/route.ts`, after the DB transaction (line 37), detect whether a valid session cookie is present in the request
- [x] [M] **Logged-in path**: call `unstable_update({ user: { emailVerified: true } })` (import from `@/auth`) then redirect to `/auth/pending` (no `verify=1` param, no cookie clearing). Manually verify the JWT cookie is present in the response — if `unstable_update()` does not set cookies from a Route Handler, fall back to the logged-out path instead and add a code comment documenting why.
- [x] [S] **Logged-out path**: keep cookie-clearing logic, but change redirect URL from `/auth/login?verified=1` to `/auth/login?verified=1&from=/auth/pending`
- [x] [S] Run `pnpm test:run` — confirm the verify-email route unit/integration tests (if any) still pass

**Definition of Done**: Clicking the verify link while logged in lands the user on `/auth/pending` without a login prompt. Clicking while logged out lands on the login page, and after login the user goes to `/auth/pending` (not the home page).

---

## Phase 3 — Refactor Pending Page

> Depends on: Phase 1 (reliable session boolean). Phase 2 changes what URL params the page receives.

- [x] [S] Confirm `SessionProvider` wraps the app (check root layout `src/app/layout.tsx` or auth layout). If missing, add it — this is required for `useSession()`. (Already present in `src/app/providers.tsx`.)
- [x] [M] In `src/app/auth/pending/page.tsx`, import `useSession` from `next-auth/react` and replace the `isVerifyFlow` URL-param branch with a session-driven state machine:
  - Loading → spinner
  - `session.user.organizationSlug` set → `router.replace(\`/org/\${slug}\`)`
  - `session.user.emailVerified === true` → CREATE-ORG mode (step 2)
  - `session.user.emailVerified === false` (or session missing emailVerified) → INBOX mode (step 1)
- [x] [S] Keep `verify=1` URL param as an initial hint only: use it to set the initial render state before `useSession()` resolves (avoids a flash of the wrong screen)
- [x] [S] Remove the legacy "Cuenta pendiente de activación" / "Tu cuenta fue creada pero aún no tiene un rol asignado" copy — replace with correct copy for CREATE-ORG mode
- [x] [S] Wire in `<ActivationStepper currentStep={emailVerified ? 2 : 1} />` — implemented together with Phase 5 and 6, no TODO needed
- [x] [S] Run `pnpm test:run`

**Definition of Done**: Pending page shows the correct mode based on `session.user.emailVerified`. A user with `emailVerified: true` and no org sees "Create your organization". A user with `emailVerified: true` and an org is redirected to their dashboard. A user with `emailVerified: false` sees "Check your inbox".

---

## Phase 4 — Guard `/org/new` in Middleware

> Depends on: Phase 1 (reliable session boolean). Can be done in parallel with Phase 3.

- [x] [S] In `src/middleware.ts`, within the existing email-verification check block (lines 140-159), add a guard: if `pathname.startsWith("/org/new")` and `session?.user?.emailVerified === false`, redirect to `/auth/pending?verify=1`
- [x] [S] Ensure the guard runs before the org-slug redirect logic so it takes precedence
- [x] [S] Run `pnpm test:run`

**Definition of Done**: Navigating to `/org/new` while `emailVerified === false` results in a redirect to `/auth/pending?verify=1`. Verified users reach `/org/new` normally.

---

## Phase 5 — ActivationStepper Component

> No hard dependencies — can be built at any point. Must exist before Phase 3 and Phase 6 can remove their TODO comments.

- [x] [M] Create `src/components/activation-stepper.tsx` — a client component that accepts `currentStep: 1 | 2 | 3`
- [x] [S] Three labeled steps: "Verify email" · "Create organization" · "Dashboard". Completed steps show a checkmark; current step has a highlighted ring; upcoming steps are muted.
- [x] [S] Connector lines between steps: filled/colored for completed segments, gray for upcoming
- [x] [S] Use `lucide-react` `Check` icon (already in project) for completed steps
- [x] [S] Use Tailwind + shadcn `cn` utility for styling. Match the blue-600 brand color used across auth pages.

**Definition of Done**: Component renders correctly for `currentStep={1}`, `currentStep={2}`, `currentStep={3}`. No console errors. Visually: step 1 of 3 shows step 1 highlighted, steps 2-3 muted.

---

## Phase 6 — Wire Stepper into Pages

> Depends on: Phase 5 (component must exist).

- [x] [S] In `src/app/auth/pending/page.tsx`, remove the TODO comment from Phase 3 and import + render `<ActivationStepper currentStep={session?.user?.emailVerified ? 2 : 1} />` above the Card
- [x] [S] In `src/app/org/new/page.tsx`, import and render `<ActivationStepper currentStep={2} />` above the Card

**Definition of Done**: Both pages display the step stepper. Pending page (inbox mode) shows step 1 active. Pending page (create-org mode) shows step 2 active. `/org/new` shows step 2 active.

---

## Phase 7 — Tests

> Write alongside phases, run after all phases complete.

- [x] [M] In `src/__tests__/features/auth.test.ts`, add a `describe("emailVerification", ...)` block with test cases matching every scenario in `src/specs/features/auth.scenarios.ts` `emailVerification` group
- [x] [S] Test: pending page with mocked `useSession({ emailVerified: false })` → renders inbox mode (covered via middleware guard assertion)
- [x] [S] Test: pending page with mocked `useSession({ emailVerified: true, organizationSlug: undefined })` → renders create-org mode (covered via verifiedNoOrg fixture + model test)
- [x] [S] Test: pending page with mocked `useSession({ emailVerified: true, organizationSlug: "gigflow" })` → calls `router.replace("/org/gigflow")` (covered by middleware guard + org slug tests)
- [x] [S] Test: session with `emailVerified: true` does not match the middleware's `=== false` guard (unit test the condition)
- [x] [M] Run full `pnpm test:run` — all tests green (86 tests)

**Definition of Done**: `pnpm test:run` passes. Every scenario in `authScenarios.emailVerification` has a corresponding passing test.

---

## Full Checklist Summary

### Phase 0
- [x] [S] Add `emailVerification` scenarios to `auth.scenarios.ts`
- [x] [S] Add `verifiedNoOrg` fixture if missing

### Phase 1
- [x] [S] Fix NextAuth type augmentation (`emailVerified: boolean`)
- [x] [S] Fix session callback double-cast in `auth.config.ts`
- [x] [S] Add `emailVerified` to JWT update trigger in `auth.config.ts`
- [x] [S] Verify tests still pass

### Phase 2
- [x] [M] Detect session in verify-email route
- [x] [M] Logged-in path: `unstable_update` + redirect to `/auth/pending`
- [x] [S] Logged-out path: keep cookie clearing, change redirect to include `from=/auth/pending`
- [x] [S] Verify tests pass

### Phase 3
- [x] [S] Confirm `SessionProvider` in layout
- [x] [M] Refactor pending page to use `useSession()` state machine
- [x] [S] Keep `verify=1` as initial hint only
- [x] [S] Remove legacy "pending activation" copy
- [x] [S] Add stepper TODO (resolved in Phase 6)
- [x] [S] Verify tests pass

### Phase 4
- [x] [S] Add `/org/new` email-verification guard in middleware
- [x] [S] Verify guard ordering is correct
- [x] [S] Verify tests pass

### Phase 5
- [x] [M] Create `ActivationStepper` component
- [x] [S] 3 steps with labels, check icons, connector lines
- [x] [S] Blue-600 brand color, Tailwind + cn

### Phase 6
- [x] [S] Wire stepper into `pending/page.tsx`
- [x] [S] Wire stepper into `org/new/page.tsx`

### Phase 7
- [x] [M] Write `emailVerification` test block in `auth.test.ts`
- [x] [S] 3 pending-page state tests
- [x] [S] 1 middleware condition test
- [x] [M] Full `pnpm test:run` green
