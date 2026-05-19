# Research: Logout Button Not Working Immediately

**Feature name:** `why-logout-button-not-working`  
**Date:** 2026-05-18  
**Branch:** main

---

## Topic

Why does the logout button not reflect the logged-out state immediately — requiring a page reload for auth state to reset?

---

## Codebase Findings

### 1. Logout call chain

**`widgets/navigation/ui.tsx` (lines 67–69)**
```ts
const handleLogout = () => {
  logout()
}
```
Calls the Effector `logout` event. No router redirect after the event fires.

**`features/auth/model.ts` (lines 101, 116)**
```ts
sample({ clock: logout, target: logoutFx })
sample({ clock: logoutFx.done, target: clearUser })
```
`logoutFx.done` triggers `clearUser`, which nulls the `$user` store.

**`shared/api/auth.ts` (lines 16–18)**
```ts
export async function logout(): Promise<void> {
  await signOut({ redirect: false })
}
```
`redirect: false` — no automatic navigation after session is cleared.

---

### 2. Session strategy — JWT

**`auth.config.ts` / `auth.ts` (line 21 each)**
```ts
session: { strategy: "jwt" }
```
Session stored in httpOnly cookie. `signOut()` tells the server to clear the cookie, but the client doesn't re-navigate on its own.

---

### 3. Middleware: cookie-presence check only

**`middleware.ts` (lines 117–123)**
```ts
const sessionToken =
  request.cookies.get("authjs.session-token")?.value ??
  request.cookies.get("__Secure-authjs.session-token")?.value ??
  ...

const isAuthenticated = Boolean(sessionToken)
```
Middleware only checks cookie **presence**, not JWT validity. After `signOut()` clears the cookie, the next middleware run (next request/navigation) will correctly block — but **no new request is made** if the user stays on the same page.

---

### 4. Authenticated layout redirect guard

**`app/(authenticated)/layout.tsx` (lines 19–32)**
```ts
useEffect(() => {
  if (!isAuthResolved) return
  if (isPending) router.replace("/auth/pending")
  else if (user === null) router.replace(`/auth/login?from=...`)
}, [isAuthResolved, isPending, pathname, router, user])
```
When `$user` becomes null (after `logoutFx.done`), this effect **should** redirect to login. This is the intended mechanism — but it depends on `$user` clearing, which depends on the async effect chain completing without interruption.

---

### 5. Effector store

**`entities/user/model.ts` (lines 9, 13)**
```ts
export const $user = createStore<User | null>(null)
$user.on(setUser, (_, user) => user).on(clearUser, () => null)
```
`$user` is only nulled after `logoutFx.done`. If the effect resolves but no re-render occurs (e.g. component already unmounted or navigation already in progress), the guard may not fire.

---

### 6. Providers — checkAuth on mount only

**`app/providers.tsx` (lines 12–14)**
```ts
useEffect(() => {
  authModel.checkAuth()
}, [])
```
`checkAuth` runs once on mount. No re-check on session-clear events, so stale state can persist.

---

## External References

- NextAuth `signOut` API: `redirect: false` leaves navigation to the caller
- NextAuth JWT strategy: session stored in `authjs.session-token` httpOnly cookie; valid until expiry even without a server DB record

---

## Key Insights

1. **Root cause**: `signOut({ redirect: false })` clears the cookie server-side but does **not navigate**. The user stays on the current authenticated page.

2. The layout redirect guard (`user === null → router.replace(login)`) is the intended recovery path — it should fire after `logoutFx.done → clearUser`. If it's not firing, the most likely reason is a timing or render issue.

3. No "redirect to login" is explicitly coded in the logout path — the entire redirect responsibility falls on the layout effect reacting to `$user === null`.

4. The middleware won't help until the user makes a new navigation request (since it only runs on request).

---

## Constraints & Risks

- `signOut` with `redirect: true` (Next.js default) would force a hard navigation to `/auth/login?callbackUrl=...` — simple fix but bypasses Effector store cleanup.
- If we add `router.push('/auth/login')` in the navigation component directly, Effector store cleanup happens in parallel (not awaited) — could cause a brief flash.
- The layout guard (`useEffect` on `user`) may race with the `router.replace` from another source.

---

## Open Questions

1. Is the layout guard redirect (`user === null`) **never** firing, or is it firing but too slowly?
2. Is `logoutFx.done` being reached? (Check if `clearUser` is dispatched — could verify with Effector DevTools or a console.log.)
3. Does the issue only happen on pages inside `(authenticated)/` or also elsewhere?
4. Is there a Sentry error on `logoutFx.fail` that might indicate the effect fails silently?
5. Should logout always hard-navigate (lose client state) or soft-navigate (keep Effector store state for transitions)?

---

## Recommended Fix Options

| Option | Change | Trade-off |
|--------|--------|-----------|
| **A (simplest)** | `signOut({ redirect: true, redirectTo: '/auth/login' })` in `shared/api/auth.ts` | Bypasses Effector cleanup; hard reload |
| **B (idiomatic)** | After `logoutFx.done`, dispatch a redirect via Effector (`sample({ clock: logoutFx.done, target: redirectFx })`) | Clean; keeps Effector as source of truth |
| **C (nav component)** | Call `router.push('/auth/login')` after `logout()` event in `handleLogout` | Quick but couples widget to routing logic |
| **D (debug first)** | Add console.log to `logoutFx.done` and layout guard to confirm which one isn't firing | Confirm root cause before changing |
