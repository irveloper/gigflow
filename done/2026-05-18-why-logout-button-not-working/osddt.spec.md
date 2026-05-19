# Spec: Immediate Logout Feedback

**Feature name:** `why-logout-button-not-working`  
**Date:** 2026-05-18  
**Status:** Draft

---

## Overview

When a user clicks the logout button, nothing visually changes — the app appears still logged in. Only after a manual page reload does the user land on the login screen. This breaks the expected logout flow: clicking logout should immediately take the user to the login page with no further action required.

---

## Research Summary

The research identified the following user-facing constraints:

- The session uses JWT stored in an httpOnly cookie. Once the cookie is cleared, the browser has no session, but the app doesn't navigate away on its own.
- There is no explicit redirect coded into the logout path. The app relies on a layout-level guard that watches the auth store (`$user === null`) to redirect to login — but this guard may not fire reliably under current conditions.
- Middleware only enforces auth on incoming requests; it cannot push the user to login while they remain on the same client-side page.
- A hard navigation (full page reload) always works because middleware sees no session cookie and redirects before any page renders.

---

## Session Context

User reports: clicking logout does nothing immediately; a page reload is needed. This is a bug, not a new feature. The fix must ensure logout is instant and reliable — no extra clicks, no reload, no stale UI.

---

## Requirements

1. **Immediate redirect on logout** — after clicking logout, the user must be redirected to the login page without any manual action (no reload, no second click).
2. **No stale authenticated UI** — once logout is initiated, no authenticated content (navigation, user menu, protected pages) should remain visible.
3. **Logout completes cleanly** — the user's local auth state is cleared before or during the redirect, not left in an ambiguous state.
4. **Login page is reachable** — after logout, the user lands on `/auth/login` (or equivalent) and can log in again normally.
5. **No regression on login flow** — the fix must not break the existing login, session persistence, or pending-verification redirect behaviours.

---

## Scope

**In scope:**
- Fixing the logout button so it redirects immediately
- Ensuring auth state (stored client-side) is cleared on logout
- The fix applies to all pages within the authenticated section of the app

**Out of scope:**
- Changing the session strategy (JWT vs database)
- Adding logout confirmation dialogs
- Multi-tab logout synchronisation
- Token invalidation on the server side (logout already clears the cookie)

---

## Acceptance Criteria

1. **AC-1**: Clicking the logout button navigates the user to `/auth/login` within one second, without a page reload.
2. **AC-2**: After logout, navigating back to any authenticated route (e.g. `/`) redirects to `/auth/login` instead of showing protected content.
3. **AC-3**: After logout and redirect, the user can log in again successfully and reach the authenticated area.
4. **AC-4**: The logout action does not produce a visible flash of authenticated content before the redirect completes.
5. **AC-5**: If the logout API call fails, the user sees an appropriate error or is still redirected (no silent failure leaving a broken state).

---

## Decisions

1. **Guard firing vs. timing**: The layout guard is NOT firing at all. The session IS being cleared (reloading after logout lands on login page, proving the cookie is gone), but no redirect occurs client-side. Fix is to add an explicit redirect, not fix guard timing.
2. **Hard vs. soft navigate**: Hard navigate — `signOut({ redirectTo: '/auth/login' })` with full browser reload. Guarantees clean state; Effector store resets naturally on mount.
3. **Scope of the broken guard**: Unknown — not tested across multiple pages. Treat as affecting all authenticated pages.
4. **logoutFx status**: Effect completes (session is cleared), so it is NOT silently failing. The missing piece is navigation after the effect succeeds.
