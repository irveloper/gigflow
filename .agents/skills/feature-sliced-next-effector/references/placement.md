# Placement Guide

Use this when deciding where new code belongs.

## Decision Table

Put code in `shared/` when it is:

- generic across business domains
- an API helper, formatter, validation helper, or UI primitive
- not owned by a single domain concept or user action
- does not import from entities, features, or app

Put code in `entities/<name>/` when it is:

- the canonical store for one domain object
- a primitive mutation of that entity's state (`setEvents`, `updateEventById`)
- a derived selector from that entity (`$todayEvents`, `$unreadCount`)
- entity-specific UI: `EventBadge`, `UserAvatar`, `NotificationDot`
- the Zod schema lives in `specs/entities/` but the type is used here

Put code in `features/<name>/` when it is:

- triggered by a user intent (`loadEvents`, `submitCheckIn`, `loginSubmitted`)
- async or side-effectful (contains an `Effect`)
- coordinating multiple entity updates via `sample`
- enforcing permissions or workflow rules
- managing pending/error/success for a use case
- NOT cross-feature — features must remain independent slices

Put code in `widgets/<name>/` when it is:

- a composed page section that combines multiple features/entities
- UI orchestration without owning business state
- too large to live in a route file

Put code in `app/` when it is:

- a route entry (`page.tsx`, `layout.tsx`)
- a provider or bootstrap (`Providers`, auth gate)
- framework integration (middleware, instrumentation)
- cross-feature coordination that has nowhere else to go

---

## Concrete Examples For This Repo

### Belongs in `entities/event/model.ts`

- `$events`
- `setEvents`
- `updateEventById`
- `removeEventById`
- `$todayEvents`
- `$upcomingEvents`

### Belongs in `features/events/model.ts`

- `loadEvents`
- `loadEventsFx` (returns from `specs/fixtures/events`)
- `checkIn`
- `checkInFx`
- `$isLoading` for loading/check-in operations
- permission checks for which roles may mutate events

### Belongs in `entities/notification/model.ts`

- `$notifications`
- `$unreadCount`
- `$unreadNotifications`
- `upsertNotification` (primitive setter — used by features)
- `markNotificationRead`
- `removeNotification`

### Does NOT belong in `app/(authenticated)/page.tsx`

- recomputing `todayEvents` from raw `$events` when `$todayEvents` already exists in entity
- defining async flows or effects
- mutating entity state directly
- `sample` wiring

### Does NOT belong in `features/check-in/model.ts`

- `import { checkIn } from "@/features/events/model"` ← feature cannot import feature
- `import { addNotification } from "@/features/notifications/model"` ← feature cannot import feature

Use entity primitives instead:
- `import { updateEventById } from "@/entities/event/model"`
- `import { upsertNotification } from "@/entities/notification/model"`

### Acceptable in `widgets/navigation/ui.tsx`

- Reading `$user`, `$userRole` from entity public API
- Reading `$unreadCount` from entity public API
- Calling `logout` from `features/auth`
- Mapping domain state to presentation

---

## Public API Rule

Every slice exposes its public surface through `index.ts`.

From outside the slice, always import via `index.ts`:

```ts
// Correct usage from widgets or app
import { $events, $todayEvents } from "@/entities/event"
import { loadEvents, eventsModel } from "@/features/events"
import { $user } from "@/entities/user"
```

Inside a slice's model file, it may import directly from sibling slices' internal paths:

```ts
// Inside features/events/model.ts — OK to import entity internals
import { setEvents, updateEventById } from "@/entities/event/model"
```

---

## Smells

| Smell | Fix |
|-------|-----|
| Feature imports from another feature | Use entity primitives |
| Import targets `entities/event/model` from outside the slice | Create `index.ts`, import from there |
| Entity store that exists only for one pending flag | Move to feature |
| `shared/` imports from `entities/` or `features/` | Restructure — shared has no knowledge of business |
| Route file doing business filtering or wiring | Extract to widget or feature model |
| Entity re-exports from a feature | Hard violation — entity must not depend on feature |
| Dead events exported but never sampled | Delete them |

---

## Page Layer Note

Canonical FSD has a `pages/` layer. This repo uses Next.js `app/` route files as the page entry layer. Follow this convention. Do not introduce a separate `pages/` layer unless the task is a deliberate structural migration.
