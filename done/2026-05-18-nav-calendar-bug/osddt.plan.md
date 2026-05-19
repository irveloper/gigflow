# Plan: Nav Calendar Link Intermittent Bug

## Architecture Overview

Two independent fixes, applied in order:

**Fix 1 — Eliminate the nav prefix race condition.**  
`organizationSlug` is already stored in the NextAuth JWT and available after the first `checkAuthFx` call (a single async round-trip). It is currently discarded in `sessionToUser`. Adding it to `UserSchema` and mapping it in `sessionToUser` means the Navigation component can derive the correct org prefix immediately after auth resolves — without waiting for the second `loadMyOrgFx` round-trip.

**Fix 2 — Redirect legacy non-org routes for org users.**  
Org users who land on `/calendar`, `/notifications`, etc. (e.g. from a stale bookmark or a race-condition click) must be redirected to `/org/<slug>/<path>`. The middleware already calls `auth()` for email-verification checks on protected routes — the org redirect can be added in the same block with no extra network cost.

**What does NOT change:**  
- `$organization` store and `loadMyOrgFx` remain. They load full org data (name, id, status) needed elsewhere in the app.  
- No new libraries. No changes to tRPC routers, Prisma schema, or JWT callbacks.  
- `auth.config.ts` is confirmed correct: `organizationSlug` is already written to the JWT token on login and on session update.

---

## Implementation Phases

### Phase 1 — SDD: Extend `UserSchema` with `organizationSlug`

**Goal**: Add `organizationSlug` as an optional field to the canonical user type so the rest of the app can consume it.

**Files:**
- `entities/user/schema.ts` — add `organizationSlug: z.string().optional()` to `UserSchema`

`specs/entities/index.ts` re-exports directly from `entities/user/schema.ts` — no change needed there. `shared/types/index.ts` does the same — no change needed.

---

### Phase 2 — Map `organizationSlug` through the auth pipeline

**Goal**: Ensure the field flows from the NextAuth session into the Effector `$user` store.

**Files:**
- `shared/lib/session.ts` — add `organizationSlug: sessionUser.organizationSlug ?? undefined` to the object returned by `sessionToUser`

`auth.config.ts` is already correct: the JWT callback writes `token.organizationSlug` on login, and the session callback exposes `session.user.organizationSlug`. No changes needed there.

---

### Phase 3 — Fix Navigation prefix derivation

**Goal**: Eliminate the race window. The nav must show correct org-prefixed links as soon as it renders for an authenticated org user.

**Files:**
- `widgets/navigation/ui.tsx` — change prefix derivation:

```ts
// Before (depends on $organization — two async hops)
const prefix = organization?.slug ? `/org/${organization.slug}` : ""

// After (uses user.organizationSlug — one async hop, from JWT)
const prefix = user?.organizationSlug
  ? `/org/${user.organizationSlug}`
  : organization?.slug
    ? `/org/${organization.slug}`
    : ""
```

The `organization` store fallback is kept for resilience (e.g. if org data loads before user data in a future refactor). Once `user` has `organizationSlug`, the prefix is correct immediately. `$organization` remains in the component for other purposes (org name display, etc.) — only the prefix derivation changes.

---

### Phase 4 — Redirect legacy routes for org users in middleware

**Goal**: Prevent org users from landing on legacy non-org routes via direct URL access.

**Files:**
- `middleware.ts` — inside the existing `auth()` block (the one that checks email verification), add org-redirect logic immediately after the email check:

```ts
const session = await auth()

// Existing email verification check
if (session?.user && session.user.emailVerified === false) {
  return NextResponse.redirect(new URL("/auth/pending?verify=1", request.url))
}

// New: redirect org users from legacy routes to org-scoped routes
const orgSlug = session?.user?.organizationSlug
if (orgSlug && !pathname.startsWith(`/org/`) && !pathname.startsWith(`/superadmin`)) {
  return NextResponse.redirect(new URL(`/org/${orgSlug}${pathname}`, request.url))
}
```

**Guard conditions explained:**
- `orgSlug` — only redirect users who belong to an org (superadmin and pending users have no slug → unaffected)
- `!pathname.startsWith('/org/')` — don't redirect users already on org routes (prevents loops)
- `!pathname.startsWith('/superadmin')` — superadmin routes are not org-scoped

**Paths affected by this redirect:**
`/calendar`, `/notifications`, `/profile`, `/reports`, `/hotel/dashboard`, `/admin/*`, `/check-in/*`, `/`

The root `/` case: the existing root RSC (`app/page.tsx`) already redirects to `/org/<slug>`. Middleware will now also catch it. Both redirects point to the same destination — no conflict.

---

### Phase 5 — Tests

**Goal**: Cover the two bug scenarios so regressions are caught.

**Files to add/update:**
- `__tests__/features/` — add or update the auth feature test to assert:
  - After `checkAuthFx.doneData`, the user store contains `organizationSlug`
  - Navigation prefix derives from `user.organizationSlug` before `$organization` loads

**Note**: Per SDD, scenarios should be added to `specs/features/` before writing tests. If no auth scenarios file exists, create one. Mirror the scenario keys in the `__tests__/features/` test file.

---

## Technical Dependencies

| Item | Status | Notes |
|---|---|---|
| NextAuth JWT with `organizationSlug` | ✅ Already works | `auth.config.ts` populates it on login |
| `UserSchema` `organizationSlug` field | ❌ Missing | Phase 1 adds it |
| `sessionToUser` mapping | ❌ Missing | Phase 2 adds it |
| `$organization` store | ✅ Unchanged | Still loads full org data; nav no longer blocks on it |
| Middleware `auth()` call | ✅ Already present | Phase 4 adds to existing block |

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Redirect loop: org user on `/org/...` triggers redirect | High if guard missing | `!pathname.startsWith('/org/')` guard prevents it |
| Superadmin broken by org redirect | Medium | `orgSlug` guard: superadmin has no slug → skip |
| `UserSchema` change breaks existing fixtures | Low | Field is `optional()` — all existing fixtures remain valid |
| `sessionToUser` returns stale slug after org change | Low | `unstable_update` is available; `loadMyOrgFx` still runs and syncs `$organization` |
| Middleware `auth()` called on every protected request | Already present | No new cost — logic is added inside the existing `auth()` block |
| `user.organizationSlug` undefined on first render before `checkAuthFx` | Expected | Nav returns `null` before `!user || !userRole` guard fires — no links rendered until auth resolves |

---

## Out of Scope

- Check-in links in `CalendarExperience` (`widgets/calendar/ui.tsx:309,449`) — separate ticket
- Superadmin navigation
- Full org data loading optimisations (`loadMyOrgFx` timing)
- Session token refresh / `unstable_update` call after org creation
