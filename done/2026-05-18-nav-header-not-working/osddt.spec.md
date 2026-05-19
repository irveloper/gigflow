# Spec: nav-header-not-working

## Overview

Authenticated users are unable to navigate between sections of the application because the navigation header generates incorrect URLs. Additionally, opening the Notifications page results in an error and an empty list, even when notifications exist.

These are regressions introduced during the org multitenancy migration (May 2026). All authenticated routes now live under `/org/[slug]/...`, but the navigation and notification-loading logic was not updated to match.

---

## Requirements

### Navigation

1. Clicking any nav item (Calendar, Notifications, Profile, etc.) must navigate the user to the correct org-scoped URL (e.g. `/org/acme/calendar`, not `/calendar`).
2. The active nav item must highlight correctly based on the current URL.
3. The "view all notifications" link in the notification bell dropdown must navigate to the org-scoped notifications page (e.g. `/org/acme/notifications`), not a root-level path.

### Notifications

4. Opening the Notifications page must display the user's notifications — including on direct navigation (e.g. typing the URL, or arriving via a link) without requiring a prior visit to the dashboard.
5. Loading notifications must not produce an error (currently returns a FORBIDDEN response).
6. Notifications already loaded (e.g. via the notification bell on the dashboard) must be visible immediately when the user navigates to the Notifications page — no redundant fetch required.

---

## Scope

### In scope
- Fixing nav link hrefs so they resolve to org-scoped paths
- Fixing the FORBIDDEN error when loading notifications
- Ensuring the Notifications page self-loads data on mount
- Fixing the notification bell "view all" link to point to the correct org-scoped path

### Out of scope
- Redesigning or adding new navigation items
- Pagination or filtering of notifications
- Real-time / push notification delivery
- Admin-level notification management (creating notifications for other users)

---

## Acceptance Criteria

1. **Nav links resolve correctly**: Clicking Calendar, Notifications, Profile, Reports, or any other nav item takes the user to the correct `/org/[slug]/...` URL for their organization.
2. **Active state accurate**: The nav highlights the item matching the current page.
3. **Notifications load without error**: Navigating to the Notifications page — whether from the nav, from the bell dropdown, or directly via URL — loads the user's notifications without a FORBIDDEN or network error.
4. **Notifications page self-sufficient**: The Notifications page shows the correct list even if the user has not visited the dashboard first in that session.
5. **Bell "view all" link works**: Clicking "Ver todas las notificaciones" in the bell dropdown navigates to the correct org-scoped notifications page.
6. **No regression**: Other pages (Calendar, Profile, Admin, etc.) continue to load correctly after these fixes.

---

## Research Summary

From `osddt.research.md`:

- **Root cause of broken nav (Bug 1)**: `features/org/model.ts` is never imported in the app, so its Effector samples never register, leaving `$organization` permanently `null`. Without a slug, the nav prefix is empty, causing all href values to point to root-level paths that don't exist.
- **Root cause of notifications FORBIDDEN (Bug 2)**: The notifications loader hardcodes `"current-user"` as the userId argument, which the tRPC router rejects because it doesn't match the actual session user ID. The router already scopes all queries to the session user, so passing any userId is unnecessary.
- **Notifications page doesn't self-load (Bug 3)**: The NotificationsCenter widget reads from the shared Effector store but never triggers a fetch on mount. It depends on the dashboard page having loaded notifications first.
- **Bell "view all" link hardcoded (Bug 4)**: The notification bell widget hardcodes `/notifications` instead of resolving the org-scoped path from the `$organization` store.
- **Key constraint**: No changes to the routing structure or tRPC schema are required — all fixes are minimal, localized changes to existing files.

---

## Open Questions

_None — all ambiguities resolved by the research file._
