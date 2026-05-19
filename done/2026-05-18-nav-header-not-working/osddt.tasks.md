# Tasks: nav-header-not-working

## Dependencies

- Phase 1 must complete before Phase 4 (Phase 4 reads `$organization` which Phase 1's fix enables)
- Phase 2 tasks (2a and 2b) must complete together (API signature and call site must match)
- Phase 3 is independent — can be done in any order relative to other phases

---

## Phase 1 — Wire org model into app bootstrap

- [x] [S] Add `import "@/features/org/model"` side-effect import to `app/providers.tsx`

**Definition of Done**: After login, navigation links resolve to `/org/[slug]/...` paths matching the user's org slug.

---

## Phase 2 — Fix notifications FORBIDDEN error

- [x] [S] `shared/api/notifications.ts` — remove `userId` parameter from `fetchNotifications`, pass empty object `{}` to tRPC query
- [x] [S] `features/notifications/model.ts` — update `loadNotificationsFx` to call `notificationsApi.fetchNotifications()` with no arguments

**Definition of Done**: Opening the Notifications page (or triggering the bell dropdown) does not throw a FORBIDDEN error. Network tab shows a successful tRPC `notifications.getAll` response.

---

## Phase 3 — NotificationsCenter self-loads on mount

- [x] [S] `widgets/notifications-center/ui.tsx` — add `import { useEffect } from "react"` (if not present) and add `useEffect(() => { notificationsModel.loadNotifications() }, [])` after the `useUnit` call

**Definition of Done**: Navigating directly to `/org/[slug]/notifications` (without visiting the dashboard first) loads and displays notifications.

---

## Phase 4 — Fix notification bell "view all" link

- [x] [S] `widgets/notification-bell/ui.tsx` — import `useUnit` from `effector-react` and `$organization` from `@/entities/organization/model`; derive `notificationsHref` from `organization?.slug`; replace hardcoded `href="/notifications"` with the dynamic value

**Depends on**: Phase 1 (ensures `$organization` is populated at runtime)

**Definition of Done**: Clicking "Ver todas las notificaciones" in the bell dropdown navigates to `/org/[slug]/notifications` for the user's org.

---

## Completion Checklist

- [x] All nav links navigate to correct `/org/[slug]/...` paths
- [x] No FORBIDDEN error on notifications load
- [x] Notifications page loads data on direct navigation
- [x] Bell "view all" link resolves to org-scoped notifications URL
- [x] No TypeScript errors introduced (run `pnpm tsc --noEmit`)
- [x] Existing tests still pass (run `pnpm test:run`)
