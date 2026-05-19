# Plan: nav-header-not-working

## Architecture Overview

Four localized bug fixes across five files. No new files, no schema changes, no new dependencies. All fixes are additive or surgical edits to existing logic.

The root cause of Bugs 1, 3, and 4 is the same missed step from the org multitenancy migration: `features/org/model.ts` (which populates `$organization`) was never imported, leaving the Effector store empty. Bug 2 is an independent stale string literal (`"current-user"`) that was never valid against the actual tRPC input guard.

Fix order matters: Bug 1 must land before Bug 4, since Bug 4's fix reads from `$organization` which Bug 1's fix enables.

---

## Implementation Phases

### Phase 1 — Wire org model into app bootstrap

**Goal**: Make `$organization` store populate on auth resolution.

**File**: `app/providers.tsx`

Add a side-effect import so Effector registers the samples in `features/org/model.ts`:

```ts
import "@/features/org/model"
```

This single line enables the existing sample chain:
```
checkAuthFx.doneData → loadMyOrgFx → organizationSet → $organization
```

No logic changes required. The org model's wiring is already correct.

---

### Phase 2 — Fix notifications FORBIDDEN error

**Goal**: Remove the hardcoded `"current-user"` string that causes the tRPC guard to throw FORBIDDEN.

**File 1**: `shared/api/notifications.ts`

Change `fetchNotifications` to not accept or pass a `userId` parameter. The tRPC router always scopes to the session user — the param is unnecessary and harmful.

```ts
// Before
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return trpc.notifications.getAll.query({ userId })
}

// After
export async function fetchNotifications(): Promise<Notification[]> {
  return trpc.notifications.getAll.query({})
}
```

**File 2**: `features/notifications/model.ts`

Update the effect call to match:

```ts
// Before
export const loadNotificationsFx = createEffect<void, Notification[]>(() =>
  notificationsApi.fetchNotifications("current-user"),
)

// After
export const loadNotificationsFx = createEffect<void, Notification[]>(() =>
  notificationsApi.fetchNotifications(),
)
```

---

### Phase 3 — NotificationsCenter self-loads data

**Goal**: Navigating directly to the Notifications page fetches data without depending on the dashboard having run first.

**File**: `widgets/notifications-center/ui.tsx`

Add a `useEffect` after the existing `useUnit` call:

```ts
import { useEffect } from "react"
import { notificationsModel } from "@/features/notifications"

useEffect(() => {
  notificationsModel.loadNotifications()
}, [])
```

Effector deduplicates concurrent effects via `pending` — calling `loadNotifications()` when data is already loaded will simply re-fetch (no flicker because the store already has data). This is acceptable for correctness.

---

### Phase 4 — Fix notification bell "view all" link

**Goal**: "Ver todas las notificaciones" resolves to the org-scoped notifications page.

**File**: `widgets/notification-bell/ui.tsx`

Read `$organization` from the Effector store and build the href dynamically:

```ts
import { useUnit } from "effector-react"
import { $organization } from "@/entities/organization/model"

// Inside the component:
const organization = useUnit($organization)
const notificationsHref = organization?.slug
  ? `/org/${organization.slug}/notifications`
  : "/notifications"

// Replace hardcoded href:
<a href={notificationsHref} ...>Ver todas las notificaciones</a>
```

---

## Technical Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `features/org/model.ts` | Exists | No changes needed — just needs to be imported |
| `entities/organization/model.ts` | Exists | `$organization` store already exported |
| `features/notifications/model.ts` | Exists | Small edit to effect call |
| `shared/api/notifications.ts` | Exists | Remove unused `userId` param |
| `widgets/notifications-center/ui.tsx` | Exists | Add useEffect |
| `widgets/notification-bell/ui.tsx` | Exists | Add useUnit + dynamic href |

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phase 1 import causes import cycle | Low | `features/org/model.ts` only imports from `entities/` and `shared/` — no cycle possible with `app/providers.tsx` |
| Removing `userId` param breaks other callers of `fetchNotifications` | None | Only one call site: `loadNotificationsFx` in `features/notifications/model.ts` |
| Double notification fetch on dashboard (bell + page) | Low | Effector `pending` guard prevents concurrent duplicate requests; store already populated so list shows immediately |
| `$organization` null on bell widget before org loads | Very low | Phase 1 fixes org loading timing; bell renders after auth resolves; fallback `/notifications` is acceptable worst case |

---

## Out of Scope

- Redesigning nav structure or adding/removing nav items
- Real-time notification delivery
- Admin notifications across users
- Notification preferences / settings UI
- Mobile nav / responsive nav changes
- Changing the tRPC notifications router schema
