# Tasks: Immediate Logout Redirect

**Feature name:** `why-logout-button-not-working`  
**Date:** 2026-05-18

---

## Phase 1 — Fix the signOut call

- [x] [S] In `shared/api/auth.ts:17`, change `signOut({ redirect: false })` to `signOut({ redirectTo: '/auth/login' })`

**Definition of Done:** Clicking "Cerrar sesión" navigates the browser to `/auth/login` immediately, without a manual reload.

---

## Phase 2 — Handle logout failure (AC-5)

- [x] [S] In `features/auth/model.ts`, add `$authError.on(logoutFx.failData, (_, error) => error.message)` alongside the existing `$authError` handlers

**Dependencies:** None — independent of Phase 1.  
**Definition of Done:** When `logoutFx` fails, the auth error store is populated (existing error display in the UI will surface it).

---

## Phase 3 — Verify

- [ ] [S] Manual test: log in → click "Cerrar sesión" → confirm redirect to `/auth/login` without reload
- [ ] [S] Manual test: after logout, navigate to an authenticated route (e.g. `/`) → confirm redirect to `/auth/login`
- [ ] [S] Manual test: log in again from `/auth/login` → confirm normal session and authenticated access
- [x] [S] Run `pnpm test:run` → confirm auth test suite passes with no regressions

**Dependencies:** Phase 1 must be complete.  
**Definition of Done:** All manual checks pass; `pnpm test:run` exits clean.
