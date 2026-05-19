# Plan: Immediate Logout Redirect

**Feature name:** `why-logout-button-not-working`  
**Date:** 2026-05-18  
**Spec:** `osddt.spec.md`

---

## Architecture Overview

The fix is a one-line change to the API layer.

**Root cause (confirmed):** `shared/api/auth.ts` calls `signOut({ redirect: false })`. This tells NextAuth to clear the session cookie without navigating. The Effector `logoutFx.done` then fires `clearUser`, but the layout guard that watches `$user === null` is not triggering a redirect reliably. The session IS cleared (proven by reload) — navigation is simply missing.

**Decision:** Use `signOut({ redirectTo: '/auth/login' })` (hard navigate). NextAuth POSTs to `/api/auth/signout` and responds with a redirect to `/auth/login`. The browser follows it, causing a full page reload. The Effector store resets naturally to its initial `null` state on remount. No client-side routing logic is needed.

**Side effect on `logoutFx.done → clearUser`:** With a hard navigate, `logoutFx` will never resolve on the client (page unloads mid-effect). The `clearUser` call becomes unreachable — but this is harmless, since the store resets on the new page load anyway.

---

## Implementation Phases

### Phase 1 — Fix the signOut call (1 file, 1 line)

**File:** `shared/api/auth.ts`

Change line 17:
```ts
// Before
await signOut({ redirect: false })

// After
await signOut({ redirectTo: '/auth/login' })
```

`redirect: false` is replaced with `redirectTo: '/auth/login'`. The `redirect` boolean defaults to `true` in NextAuth v5, so this enables the redirect and targets the correct URL.

**No other files need to change.** The `logoutFx` effect, the `sample` connections in `features/auth/model.ts`, and `handleLogout` in `widgets/navigation/ui.tsx` all remain as-is.

---

### Phase 2 — Verify AC-5: logout failure handling

Check whether `logoutFx.fail` has any handler in `features/auth/model.ts`. Currently it does not (no `$authError.on(logoutFx.failData, ...)` exists).

If the `signOut` POST fails (network error, server down), the effect will throw and `logoutFx.fail` will fire — but the user will see nothing and remain on the authenticated page.

**Minimal fix:** Add a failure handler to surface the error:

```ts
// features/auth/model.ts — add after existing $authError handlers
$authError.on(logoutFx.failData, (_, error) => error.message)
```

This satisfies AC-5 ("user sees an appropriate error") without changing the logout path for the happy case.

---

### Phase 3 — Verify

Manual steps:
1. Log in → click "Cerrar sesión" → confirm redirect to `/auth/login` without page reload.
2. After logout, paste an authenticated URL (e.g. `/`) → confirm redirect to `/auth/login`.
3. Log in again from the login page → confirm normal session is established.
4. Run `pnpm test:run` — confirm auth tests still pass.

---

## Technical Dependencies

- **NextAuth v5 (`next-auth`)** — `signOut` from `next-auth/react` accepts `{ redirectTo?: string, redirect?: boolean }`. `redirect` defaults to `true`; omitting `redirect: false` and adding `redirectTo` is the correct v5 API.
- No new libraries. No schema changes. No DB migrations.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `redirectTo` not supported in the installed next-auth version | Low | Check next-auth version in `package.json`; fall back to `redirect: true` if v4 |
| `logoutFx` never resolves → unhandled promise warning in console | Medium | Acceptable; page unloads before the promise chain completes — no user-facing impact |
| Logout loop if `/auth/login` is behind auth middleware | Low | Middleware already allows unauthenticated access to `/auth/*` routes |
| Auth tests mock `signOut` and break on the changed options | Low | Tests mock at the `signOut` call level; argument shape change is non-breaking for mocks |

---

## Out of Scope

- Multi-tab logout synchronisation
- Server-side session invalidation (cookie is already cleared by `signOut`)
- Changing the JWT strategy
- Logout confirmation dialog
- Soft client-side redirect (decided against in spec)
