# Spec: Nav Calendar Link Intermittent Bug

## Overview

After logging in, clicking "Calendar" (or any nav link) sometimes navigates to a wrong route — `/calendar` instead of `/org/<slug>/calendar`. The bug is intermittent because it only happens during a brief window after page load while the app is still fetching the user's organization. During that window all nav links are missing the org prefix, so clicking them lands users on legacy non-org routes.

Users experience this as the calendar (and other nav items) "not working" — either they see a blank loading spinner or they land on an unexpected URL that does not match the rest of their session context. The bug affects **all** navigation links in the header, not just the calendar link.

## Research Summary

- The navigation derives its link prefix exclusively from the `$organization` Effector store, which requires two sequential async round-trips after mount to populate.
- The user's `organizationSlug` is already available in the JWT session cookie (no extra DB call), but it is discarded when the session is converted to the app's `User` type — leaving the navigation with no fast path to the slug.
- A secondary bug exists in the Calendar widget: check-in links inside it are hardcoded to `/check-in/<id>` and also miss the org prefix.

## Requirements

1. **All nav links are always correct after login.** From the moment the navigation bar is first visible to an authenticated org user, every link must point to the correct org-scoped URL (e.g. `/org/<slug>/calendar`, `/org/<slug>/notifications`, `/org/<slug>/profile`). This includes all items in the header nav.

2. **No stale links during loading.** The navigation must not show clickable links that lead to wrong routes at any point during the authenticated session, including immediately after login and after a page reload.

3. **Superadmin and pending users unaffected.** Users without an organization (superadmin, pending approval) continue to see navigation links without an org prefix, exactly as today.

4. **Calendar page is reachable via nav on every click.** Clicking "Calendar" in the nav must consistently navigate to a working calendar page. No user should ever see a broken or blank screen as a result of clicking that link.

## Scope

### In scope
- Fix nav links for org users so they resolve correctly before the full org record is loaded
- Ensure the behavior is consistent across page load, login redirect, and page refresh

### Out of scope
- Check-in links inside the Calendar widget (separate ticket)
- Any changes to the org settings, billing, or unrelated navigation items
- Navigation behavior for the superadmin dashboard

## Acceptance Criteria

1. **Immediate after login**: A user who logs in and clicks any nav link (Calendar, Notifications, Profile, etc.) within one second of the nav appearing must land on the correct org-scoped URL (e.g. `/org/<slug>/calendar`), never on a non-org route.

2. **After hard reload**: A user who reloads the page while authenticated must see correct org-prefixed nav links from the first render (no flash of wrong links).

3. **Slow network simulation**: With network throttled to "Slow 3G" in DevTools, clicking any nav link immediately after the nav appears must navigate to the correct org-scoped URL. No link in the header must ever point to a non-org route for an org user.

4. **Superadmin unaffected**: A superadmin user's nav links must not change — they should continue working as before (no org prefix).

5. **Pending user unaffected**: A user awaiting role assignment must continue to be redirected to `/auth/pending` without errors.

6. **No regression on org-scoped calendar**: When the nav correctly shows `/org/<slug>/calendar` and the user clicks it, the calendar page loads and displays events.

7. **Legacy routes redirect**: An org user who accesses `/calendar`, `/notifications`, `/profile`, or any other non-org authenticated route directly (e.g. from a bookmark) must be redirected to the equivalent `/org/<slug>/*` URL.

## Decisions

1. **Legacy routes**: Org users accessing non-org routes (e.g. `/calendar`) directly must be redirected to the equivalent org-scoped URL. Only `/org/<slug>/*` routes are valid for org users.

2. **Check-in links**: Out of scope for this ticket — tracked separately.
