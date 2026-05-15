# Plan: Calendar & Events Feature Completeness

**Date**: 2026-04-24  
**Feature**: `calendar-events-features`  
**Stack**: Next.js 16 App Router · Effector · FullCalendar · shadcn/ui · Vitest

---

## Architecture Overview

All changes follow the existing FSD dependency direction:
```
app → widgets → features → entities → shared
                                     ↑
                              specs/ (no imports from app layers)
```

**Key constraints:**
- Entity models (`entities/event/model.ts`) own `$events` and primitive mutation events. Features wire effects to those primitives via `sample`.
- Features must never import from other features. Cross-feature coordination is done via entity primitives only (already the pattern in `features/check-in/model.ts`).
- Widgets import from feature barrels (`@/features/events`, `@/features/hotels`, `@/features/musicians`), never directly from entity models.
- All new stores/events/effects follow the effector `fork`-safe pattern (no module-level side effects during store creation).

**Check-in merge fix strategy:**  
`features/check-in/model.ts` already calls `updateEventById` but passes a synthetic skeleton object (empty `title`, `hotel`, etc.) which overwrites real event data. Fix: use `sample({ source: $events, clock: submitCheckInFx.doneData, fn: (events, data) => ... })` to find the existing event and return a properly merged partial update. The entity's `updateEventById` does a full replacement by id, so the merged object must carry all original fields.

**Manager confirmation flow:**  
A new derived store `$pendingCheckIns` in `features/events` filters `$events` for `status === "in-progress" && checkedIn === true`. This powers a new confirmation section inside the admin events widget (a tab, not a new page). New events `confirmCheckIn(id)` and `rejectCheckIn(id)` update the event via entity primitives.

**Fixture date anchor fix:**  
Replace the hardcoded `new Date("2026-04-21")` anchor in `specs/fixtures/events.ts` with `new Date()` so offsets are always relative to today. All tests that use `allEvents` or named event fixtures rely on the store being seeded directly via `fork({ values: ... })` — they are immune to the date of the fixture data. The only tests that assert on derived stores (`$todayEvents`, `$upcomingEvents`) currently seed via `fork({ values: [[$events, allEvents]] })` — they will work correctly once fixtures are today-relative.

---

## Implementation Phases

### Phase 1 — Fix test infrastructure (blocker for all later test work)

**Goal**: `pnpm test:run` exits 0 with no timeouts.

**Steps:**

1. **Diagnose the timeout** in `musicians.test.ts` and `notifications.test.ts`.  
   - Both fail only on the "loads X on demand" test that calls `allSettled(loadEvent, { scope })` where `loadEvent` is a `createEvent()` wired to an effect via `sample`.  
   - Events tests use the identical pattern and pass — difference is the import chain.  
   - Likely cause: deep import chain through `@/specs/fixtures` index re-exports triggers a module-level side-effect or circular resolution in the jsdom environment during collection.  
   - Investigation: add `--reporter=verbose` and check whether collection or execution is the bottleneck. If collection, isolate the problematic import by replacing `@/specs/fixtures` with direct fixture file imports in the model files.

2. **Fix**: if circular/deep import is the cause, change `features/musicians/model.ts` and `features/notifications/model.ts` to import directly from their specific fixture files (`@/specs/fixtures/musicians`, `@/specs/fixtures/notifications`) instead of the barrel `@/specs/fixtures`.

3. **Fix fixtures date anchor**: in `specs/fixtures/events.ts`, change:
   ```ts
   const D = (offsetDays: number) => {
     const d = new Date("2026-04-21")   // ← hardcoded
   ```
   to:
   ```ts
   const D = (offsetDays: number) => {
     const d = new Date()               // ← always today
   ```
   Remove the comment about the base date. Update `completedLatinJazz.checkInTime` and `pastBoleros.checkInTime` to use `new Date(D(-1))` / `new Date(D(-3))` ISO strings instead of hardcoded timestamps.

4. Run `pnpm test:run` — must exit 0 before proceeding.

---

### Phase 2 — Fix check-in effect (store merge)

**Goal**: After check-in, `$events` reflects the update with all original event fields preserved.

**Files**: `features/check-in/model.ts`

**Steps:**

1. Import `$events` from `@/entities/event` (already available as a re-export).

2. Replace the broken `sample` that passes a skeleton to `updateEventById`:
   ```ts
   // BEFORE (broken — overwrites real event with skeleton)
   sample({
     clock: submitCheckInFx.doneData,
     fn: (data) => ({ id: data.eventId, title: "", ... }),
     target: updateEventById,
   })
   
   // AFTER — merge check-in data onto the existing event
   sample({
     source: $events,
     clock: submitCheckInFx.doneData,
     fn: (events, data) => {
       const existing = events.find((e) => e.id === data.eventId)
       if (!existing) return null
       return {
         ...existing,
         status: "in-progress" as const,
         checkedIn: true,
         checkInTime: data.timestamp,
         checkInLocation: data.location,
         checkInComments: data.comments,
       }
     },
     target: updateEventById,  // updateEventById accepts Event | null — add null guard at entity layer or filter
   })
   ```
   
   Note: `updateEventById` in the entity model does `.map((e) => e.id === updated.id ? updated : e)` — it needs a full `Event`, not null. Add a `filter: Boolean` to the sample, or change the `fn` to only fire when the event is found.

3. The notification sample stays as-is.

4. Update `specs/features/events.scenarios.ts` check-in scenario to document the new field values.

5. Update (or add) test in `__tests__/features/events.test.ts` or `__tests__/features/check-in.test.ts` covering the merged update.

---

### Phase 3 — New event actions in feature model

**Goal**: Feature model exposes `cancelEvent`, `completeEvent`, `confirmCheckIn`, `rejectCheckIn`.

**Files**: `features/events/model.ts`, `entities/event/model.ts` (no changes needed — `updateEventById` handles all)

**Steps:**

1. Add to `features/events/model.ts`:
   ```ts
   export const cancelEvent = createEvent<string>()    // eventId
   export const completeEvent = createEvent<string>()  // eventId
   export const confirmCheckIn = createEvent<string>() // eventId
   export const rejectCheckIn = createEvent<string>()  // eventId
   ```

2. Wire each via `sample` using `source: $events` to build the full updated event:
   ```ts
   // cancelEvent
   sample({
     source: $events,
     clock: cancelEvent,
     fn: (events, id) => events.find((e) => e.id === id),
     filter: (event): event is Event => event != null,
     // map to { ...event, status: "cancelled" }
     target: updateEventById,
   })
   ```
   Same pattern for `completeEvent` (sets `status: "completed"`, `checkedIn: true`), `confirmCheckIn` (same as completeEvent), and `rejectCheckIn` (sets `status: "scheduled"`, `checkedIn: false`, clears `checkInTime`/`checkInLocation`/`checkInComments`).

3. Add derived store:
   ```ts
   export const $pendingCheckIns = $events.map((events) =>
     events.filter((e) => e.status === "in-progress" && e.checkedIn)
   )
   ```

4. Export all new items from `features/events/index.ts`.

5. Update `eventsModel` consolidated export object.

---

### Phase 4 — Admin events widget fixes

**Goal**: List loads on mount, delete works, edit dialog is complete, rosters come from stores.

**Files**: `widgets/admin-events/ui.tsx`

**Steps:**

1. **Load on mount**: add `useEffect(() => { eventsModel.loadEvents(); hotelsModel.loadHotels(); musiciansModel.loadMusicians() }, [])`. Import `hotelsModel` from `@/features/hotels` and `musiciansModel` from `@/features/musicians`.

2. **Delete**: replace the noop delete button with:
   - `useState` for `eventToDelete: Event | null`
   - `AlertDialog` (shadcn) opened when delete icon clicked, showing event title
   - On confirm: call `eventsModel.deleteEvent(id)`; show toast

3. **Edit dialog**: 
   - `useState` for `eventToEdit: Event | null`
   - Reuse the create form fields but pre-populate from `eventToEdit`
   - Lock `date`, `time`, `musician` fields when `status === "in-progress" || status === "completed"`
   - On save: run `getSchedulingConflicts` against all events except the edited event (`ignoreEventId`); if conflict show error; else call `eventsModel.updateEvent(mergedEvent)`
   - Hotels select: `useUnit({ hotels: hotelsModel.$hotels })` — map to `{ value: h.id, label: h.name }`
   - Musicians select: `useUnit({ musicians: musiciansModel.$musicians })` — map to `{ value: m.id, label: m.name }`

4. **Remove hardcoded arrays**: delete `HOTELS`, `MUSICIANS`, `CONCEPTS` constants. Concepts can stay as a local UI hint (not domain data).

5. **Cancel action**: add a "Cancelar" menu item (or icon button) on rows where `status !== "completed" && status !== "cancelled"`. Confirmation via `AlertDialog`. On confirm: `eventsModel.cancelEvent(id)`.

6. **Direct complete action**: add a "Marcar completado" action on rows where `status === "scheduled" || status === "in-progress"`. Single confirmation. On confirm: `eventsModel.completeEvent(id)`.

7. **Status color consistency**: remove local `STATUS_COLOR` / `STATUS_TEXT` constants. Use `getEventStatusLabel(event)` and derive badge variant from `getCalendarEventTone(event)` (map: `"checked-in"` → `"default"`, `"cancelled"` → `"destructive"`, `"in-progress"` → `"secondary"`, `"scheduled"` → `"outline"`).

---

### Phase 5 — Manager check-in confirmation dashboard

**Goal**: Section within `/admin/events` showing pending check-ins with confirm/reject.

**Files**: `widgets/admin-events/ui.tsx` (new tab/section), no new page needed.

**Steps:**

1. Add a tab switcher (shadcn `Tabs`) to the admin events widget with two tabs:
   - "Eventos" — existing event list
   - "Pendientes de confirmación" — pending check-in list (shows badge count)

2. Pending tab content:
   - Reads `$pendingCheckIns` from `@/features/events`
   - Each row shows: event title, musician name, hotel, check-in time, check-in location (if present)
   - Two buttons: "Confirmar" (calls `eventsModel.confirmCheckIn(id)`) and "Rechazar" (calls `eventsModel.rejectCheckIn(id)`)
   - No extra confirmation dialog — single click, as per spec

3. Show pending count as badge on the tab label when `$pendingCheckIns.length > 0`.

4. Empty state: "No hay check-ins pendientes de confirmación."

---

### Phase 6 — Calendar widget status consistency

**Goal**: Calendar widget and all sidebars derive status display from entity lib functions.

**Files**: `widgets/calendar/ui.tsx`

**Steps:**

1. Audit all `Badge variant=` and status label strings in the calendar widget against `getEventStatusLabel` and `getCalendarEventTone`.  
2. The featured event panel already calls `getEventStatusLabel` — confirm it handles all 4 statuses correctly now that `in-progress` + `checkedIn: true` is a real state.  
3. The "today's events" and "upcoming events" lists also use `getEventStatusLabel` — should be consistent already but verify.
4. No structural changes expected — this is a verification step that may produce minor tweaks.

---

### Phase 7 — Tests

**Goal**: Full test coverage for all new behavior; all existing tests pass.

**Files**: `__tests__/features/calendar.test.ts` (new), updates to `__tests__/features/events.test.ts` and `__tests__/features/check-in.test.ts`

**Steps:**

1. **`__tests__/features/calendar.test.ts`** — new file covering entity lib:
   - `eventsOverlap`: overlapping pair, non-overlapping pair, same-start edge case
   - `getSchedulingConflicts`: detects conflict for same musician, ignores different musician, ignores cancelled events, respects `ignoreEventId`
   - `getEventsInRange`: includes boundary start, excludes boundary end, excludes out-of-range
   - `sortEventsChronologically`: sorts by date then time
   - `toFullCalendarEvents`: id, start, end, classNames, extendedProps.originalEvent
   - `getCalendarSummary`: totalEvents, completedEvents, hotelCount, estimatedHours

2. **`__tests__/features/events.test.ts`** — add:
   - `cancelEvent` sets `status: "cancelled"`
   - `completeEvent` sets `status: "completed"` and `checkedIn: true`
   - `confirmCheckIn` sets `status: "completed"`
   - `rejectCheckIn` resets `status: "scheduled"`, `checkedIn: false`
   - `$pendingCheckIns` contains only in-progress + checkedIn events

3. **`__tests__/features/check-in.test.ts`** — update:
   - After `submitCheckIn`, `$events` contains the updated event with `checkedIn: true`, `status: "in-progress"`, all original fields preserved (title, hotel, etc.)

4. Run `pnpm test:run` — must exit 0.

---

## Technical Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `effector` | Installed | `sample({ source, clock, fn, filter })` pattern needed |
| `@fullcalendar/*` | Installed | No new FC features needed |
| shadcn `Tabs` | Check | May need `npx shadcn@latest add tabs` if not present |
| shadcn `AlertDialog` | Check | May need `npx shadcn@latest add alert-dialog` if not present |
| `date-fns` | Installed | Used in fixture D() helper |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `updateEventById` replaces the whole event — partial updates require spreading existing event | Always use `sample({ source: $events, ... })` to read existing event before building update |
| `$events` shared across all widgets — mutations must be regression-tested | Run full test suite after each phase |
| FullCalendar re-renders on every `$events` update — may cause flicker during confirmation | Acceptable at current scale; memoization can be added later if needed |
| Fixture date anchor change could break hardcoded assertions | Audit all test assertions that reference specific dates (e.g. `"2026-04-21"`) and replace with relative comparisons |
| Hardcoded `checkInTime` timestamps in fixtures (ISO strings) will need updating | Use `new Date(D(-1)).toISOString()` pattern instead of hardcoded strings |
| Import chain causing test timeout (Phase 1) is not fully diagnosed | If direct import fix doesn't resolve it, fallback: inline the fixture data in the models using lazy import inside the effect fn |

---

## Out of Scope

- `/events/[id]` detail route
- Calendar `dateClick` → create from calendar
- Filter / search UI on calendar page
- Pagination on admin events list
- Real backend, photo storage, or file upload to server
- Timezone support
- Musician-facing event list (outside calendar/check-in)
- Hotel manager role (beyond what already exists)
