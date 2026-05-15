# Effector Patterns

Use these rules when authoring or refactoring Effector code in this repo.

## Preferred Shape

Entity model:

- owns durable business data
- exposes primitive update events (`setEvents`, `updateEventById`, `removeEventById`)
- exposes derived stores (`$todayEvents`, `$upcomingEvents`)
- stays mostly synchronous and domain-oriented
- does NOT own pending/error/isLoading for async operations

Feature model:

- owns user intent events (`loadEvents`, `checkIn`, `submitCheckIn`)
- owns effects (`loadEventsFx`, `checkInFx`)
- owns pending/error/success state for those effects
- wires intent → effects → entity primitives with `sample`
- does NOT own the business data itself — entity does

---

## Good Pattern

`entities/event/model.ts`

```ts
export const setEvents = createEvent<Event[]>()
export const updateEventById = createEvent<Event>()
export const $events = createStore<Event[]>([])
  .on(setEvents, (_, events) => events)
  .on(updateEventById, (events, updated) => events.map(...))
export const $todayEvents = $events.map(...)
```

`entities/event/index.ts` (public API — this is what other layers import)

```ts
export { $events, $todayEvents, $upcomingEvents, setEvents, updateEventById, removeEventById } from "./model"
```

`features/events/model.ts`

```ts
// Import entity primitives via internal path (same project, feature owns the wiring)
import { setEvents, updateEventById } from "@/entities/event/model"

export const loadEvents = createEvent()
export const loadEventsFx = createEffect<void, Event[]>(async () => { ... })
export const $isLoading = createStore(false).on(loadEventsFx.pending, (_, p) => p)

sample({ clock: loadEvents, target: loadEventsFx })
sample({ clock: loadEventsFx.doneData, target: setEvents })
sample({ clock: checkInFx.doneData, target: updateEventById })
```

`widgets/navigation/ui.tsx` (consumes via public API)

```ts
// Import from slice public API, not internal path
import { $unreadCount } from "@/entities/notification"
import { $user, $userRole } from "@/entities/user"
import { logout } from "@/features/auth"
```

---

## Feature Isolation Pattern

Features must not import from other features. Use entity primitives for coordination.

```ts
// WRONG — cross-feature import
import { checkIn } from "@/features/events/model"
import { addNotification } from "@/features/notifications/model"

// RIGHT — entity primitives used directly
import { updateEventById } from "@/entities/event/model"
import { upsertNotification } from "@/entities/notification/model"

sample({
  clock: submitCheckInFx.doneData,
  fn: (result) => result.updatedEvent,
  target: updateEventById,
})

sample({
  clock: submitCheckInFx.done,
  fn: () => ({ title: "Check-in exitoso", type: "success", read: false, message: "..." }),
  target: upsertNotification,
})
```

---

## Avoid

- Storing `loadEventsFx.pending` inside an entity store — that is use-case state, belongs in feature
- Putting domain collections only inside a feature — entities own the data
- Calling effects directly from React when there is already a semantic event
- Imperative `.watch()` chains for normal business flow
- Features importing from features (use entity primitives instead)
- Importing from internal segment paths from outside the slice (use `index.ts`)

---

## Domain Guidance

This repo has `shared/lib/effector.ts` with `appDomain`.

Use it when you need one of these:

- grouped resets
- slice subdomains for named logging
- test setup that benefits from domain ownership

Do not churn stable files to replace `createStore` with `appDomain.createStore` if the task is unrelated.

---

## React Guidance

- Use `useUnit` in client components.
- Keep store selection close to the component boundary.
- Do not subscribe to raw stores when a derived store already expresses the UI need.
- Do not compute business selectors in render — let the model own them.

---

## Testing Guidance

Tests verify behavior described in `specs/features/*.scenarios.ts`, not implementation details.

- Use effector's `fork()` + `allSettled()` to test model behavior in isolation.
- Assert on entity stores (the data) and feature stores (pending/error) separately.
- Import from internal segment paths in tests (`entities/event/model`) since tests are inside the slice boundary conceptually.
- Never assert on private implementation — only on what the scenario describes.
