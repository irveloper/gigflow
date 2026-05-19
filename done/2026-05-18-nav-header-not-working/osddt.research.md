# Research: nav-header-not-working

## Topic
Navigation links pointing to wrong paths and notifications failing to load. Three distinct bugs identified.

---

## Codebase Findings

### Architecture overview
- Routes: all authenticated pages live under `/org/[slug]/...` (`app/org/[slug]/layout.tsx`)
- Nav: `widgets/navigation/ui.tsx` — client component, reads `$organization` from Effector store to build href prefix
- Auth init: `app/providers.tsx` calls `authModel.checkAuth()` on mount
- Org loading: `features/org/model.ts` — samples `checkAuthFx.doneData` → `loadMyOrgFx` → `organizationSet`
- Notifications: `features/notifications/model.ts` → `shared/api/notifications.ts` → tRPC `notifications.getAll`

---

## Bug 1 — Navigation hrefs broken (wrong paths)

**Root cause**: `features/org/model.ts` is **never imported** anywhere in the app.

Effector samples only run if the module has been imported. Since `features/org/model.ts` is never imported, the sample:
```ts
sample({
  clock: checkAuthFx.doneData,
  filter: (user) => user !== null,
  target: loadMyOrgFx,   // never wires
})
```
…never registers. So `$organization` stays `null` forever.

In `widgets/navigation/ui.tsx`:
```ts
const prefix = organization?.slug ? `/org/${organization.slug}` : ""
```
With `organization = null`, prefix = `""`. Nav items become:
- `"/calendar"` instead of `"/org/acme/calendar"`
- `"/notifications"` instead of `"/org/acme/notifications"`
- etc.

All nav links resolve to nonexistent root-level routes.

**Files involved**:
- `app/providers.tsx` — missing `import "@/features/org/model"` side-effect import
- `features/org/model.ts` — logic correct, just not registered
- `widgets/navigation/ui.tsx:59` — prefix derivation

---

## Bug 2 — Error loading notifications (FORBIDDEN)

**Root cause**: `loadNotificationsFx` passes `"current-user"` as userId to the tRPC query, but the router throws FORBIDDEN when `input.userId !== session.user.id`.

In `features/notifications/model.ts:37`:
```ts
export const loadNotificationsFx = createEffect<void, Notification[]>(() =>
  notificationsApi.fetchNotifications("current-user"),
)
```

In `shared/api/notifications.ts:7`:
```ts
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return trpc.notifications.getAll.query({ userId })
}
```

In `server/routers/notifications.ts:39`:
```ts
if (input.userId && input.userId !== userId) {
  throw new TRPCError({ code: "FORBIDDEN" })
}
```
`"current-user" !== session.user.id` → `FORBIDDEN` every time.

**Fix**: `fetchNotifications` should pass no userId (or undefined) since the router always scopes to session user anyway.

**Files involved**:
- `features/notifications/model.ts:37`
- `shared/api/notifications.ts:7-9`

---

## Bug 3 — Notifications not loaded on /notifications page

**Root cause**: `widgets/notifications-center/ui.tsx` reads from `notificationsModel.$notifications` but never dispatches `loadNotifications()` on mount. Data only loads if the user visited the dashboard first (where `OrgHomePage` calls `notificationsModel.loadNotifications()` in a `useEffect`).

If a user navigates directly to `/org/[slug]/notifications`, the list will be empty (no fetch triggered).

**Files involved**:
- `widgets/notifications-center/ui.tsx` — missing `useEffect(() => { notificationsModel.loadNotifications() }, [])`

---

## Bug 4 — Notification bell "view all" link broken

In `widgets/notification-bell/ui.tsx:124`:
```tsx
<a href="/notifications" ...>Ver todas las notificaciones</a>
```
Links to `/notifications` (root, non-existent) instead of `/org/${slug}/notifications`.

The widget doesn't have access to the slug. Needs to read from `$organization` store or accept `prefix` as prop.

---

## Key Insights

1. Effector module side-effect import pattern is critical — unimported modules = unregistered samples.
2. `features/org/model.ts` is the only missing side-effect import; `features/auth/model.ts` is correctly imported in `providers.tsx`.
3. The tRPC notifications router always scopes to session user — passing any userId is unnecessary and dangerous.
4. `NotificationsCenter` widget is the only widget that doesn't self-load its data.

---

## Constraints & Risks

- `providers.tsx` already imports `authModel` — adding `features/org` import is a one-line change with no side effects beyond wiring the existing Effector graph.
- Removing the `userId` param from `fetchNotifications` is a breaking change to that function's signature, but it's only called from one place (`loadNotificationsFx`).
- The notification bell "view all" fix requires reading `$organization` from the widget — consistent with how `Navigation` already does it.

---

## Open Questions

1. Should `NotificationsCenter` also call `loadNotifications` on unmount cleanup (to avoid stale data on re-mount)? Probably not needed — data is shared across the Effector graph.
2. Is there a reason `features/org/model.ts` wasn't imported? Possibly an oversight from the org multitenancy migration (done/2026-05-16-saas-org-multitenancy/).
3. Should the `fetchNotifications` API function be removed entirely in favor of always passing no userId, or keep for future admin use?
