# Tasks: Nav Calendar Link Intermittent Bug

## Dependencies

```
Phase 1 → Phase 2 → Phase 3
Phase 1 → Phase 4 (middleware needs User type for type safety)
Phase 1–4 → Phase 5 (tests validate all changes)
```

---

## Phase 1 — SDD: Extend UserSchema

**Goal**: `organizationSlug` is part of the canonical `User` type before any code references it.

- [x] [S] Add `organizationSlug: z.string().optional()` to `UserSchema` in `entities/user/schema.ts`

**Definition of Done**: `User` type (inferred via `z.infer<typeof UserSchema>`) includes `organizationSlug?: string`. TypeScript compiler accepts it across the codebase with no new errors.

---

## Phase 2 — Map organizationSlug through the auth pipeline

**Goal**: Field flows from NextAuth session → `sessionToUser` → Effector `$user` store.

- [x] [S] Add `organizationSlug: sessionUser.organizationSlug ?? undefined` to the return object in `shared/lib/session.ts:sessionToUser`

**Definition of Done**: After `checkAuthFx` resolves, `$user.getState().organizationSlug` equals the value stored in the JWT for an org user.

---

## Phase 3 — Fix Navigation prefix derivation

**Goal**: Nav links point to correct org-scoped routes the moment the nav is visible, with no race window.

- [x] [S] Update `widgets/navigation/ui.tsx` prefix derivation to use `user?.organizationSlug` as primary source with `organization?.slug` as fallback

**Definition of Done**: On slow network (throttled in DevTools), clicking any nav link immediately after it appears navigates to `/org/<slug>/<path>`, not to a non-org route.

---

## Phase 4 — Redirect legacy routes in middleware

**Goal**: Org users who hit a legacy non-org route (e.g. from a bookmark or stale URL) are redirected to the correct org-scoped URL server-side.

- [x] [M] Add org-redirect guard in `middleware.ts` inside the existing `auth()` block, after the email-verification check — redirect org users from non-`/org/` protected routes to `/org/<slug><pathname>`

**Definition of Done**:
- `GET /calendar` (org user) → 307 redirect to `/org/<slug>/calendar`
- `GET /notifications` (org user) → 307 redirect to `/org/<slug>/notifications`
- `GET /org/<slug>/calendar` (org user) → no redirect (passes through)
- `GET /calendar` (superadmin, no org slug) → no redirect (passes through)
- `GET /calendar` (unauthenticated) → redirect to `/auth/login` (existing behaviour unchanged)

---

## Phase 5 — Tests

**Goal**: Regression coverage for both the race-condition fix and the redirect behaviour.

- [x] [S] Add `organizationSlug` to the user fixture in `specs/fixtures/index.ts` (or relevant fixture file) so tests have a realistic user shape
- [x] [M] Write or update auth feature scenario in `specs/features/` — add scenario: "user store contains organizationSlug after checkAuthFx resolves"
- [x] [M] Write or update test in `__tests__/features/` mirroring the scenario — assert `$user.getState().organizationSlug` is populated after mock `checkAuthFx.doneData`
- [x] [S] Run `pnpm test:run` and confirm all tests pass with no regressions

**Definition of Done**: `pnpm test:run` exits 0. The new scenario is covered. No existing tests are broken.
