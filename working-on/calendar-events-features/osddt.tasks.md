# Tasks: Calendar & Events Feature Completeness

**Feature**: `calendar-events-features`  
**Date**: 2026-04-24

---

## Phase 1 — Fix test infrastructure

> **Definition of Done**: `pnpm test:run` exits 0, no timeouts, no custom timeout overrides.

- [ ] [S] Diagnose timeout in `musicians.test.ts` / `notifications.test.ts` — add `--reporter=verbose` run, identify whether hang is in collect or execute phase
- [ ] [S] Fix import chain: change `features/musicians/model.ts` and `features/notifications/model.ts` to import directly from specific fixture files instead of the barrel (`@/specs/fixtures/musicians`, `@/specs/fixtures/notifications`)
- [ ] [S] Fix fixture date anchor in `specs/fixtures/events.ts` — replace `new Date("2026-04-21")` with `new Date()` in the `D()` helper
- [ ] [S] Fix hardcoded `checkInTime` / timestamp strings in `eventFixtures.completedLatinJazz` and `eventFixtures.pastBoleros` — derive from `new Date(D(-1)).toISOString()` pattern
- [ ] [S] Run `pnpm test:run` and confirm all existing tests pass

---

## Phase 2 — Fix check-in store merge

> **Definition of Done**: After check-in submission, `$events` entry has `checkedIn: true`, `status: "in-progress"`, and all original fields (title, hotel, musician, date, time, durationMinutes) intact.

- [ ] [S] In `features/check-in/model.ts`, import `$events` from `@/entities/event`
- [ ] [M] Replace broken `sample → updateEventById` with source-driven merge:
  - `sample({ source: $events, clock: submitCheckInFx.doneData, fn: (events, data) => { const e = events.find(x => x.id === data.eventId); if (!e) return null; return { ...e, status: "in-progress", checkedIn: true, checkInTime: data.timestamp, checkInLocation: data.location, checkInComments: data.comments } }, filter: Boolean, target: updateEventById })`
- [ ] [S] Update `specs/features/events.scenarios.ts` check-in scenario — document that `status` becomes `"in-progress"` and original fields are preserved
- [ ] [S] Update `__tests__/features/check-in.test.ts` — assert merged update (title/hotel/musician preserved, checkedIn/status/checkInTime set)

---

## Phase 3 — New event actions in feature model

> **Definition of Done**: `features/events/model.ts` exports `cancelEvent`, `completeEvent`, `confirmCheckIn`, `rejectCheckIn`, `$pendingCheckIns`; all wired via entity primitives; exported from barrel `features/events/index.ts`.

- [ ] [S] Add `cancelEvent`, `completeEvent`, `confirmCheckIn`, `rejectCheckIn` events to `features/events/model.ts`
- [ ] [M] Wire each via `sample({ source: $events, clock, fn, filter: Boolean, target: updateEventById })`:
  - `cancelEvent(id)` → `{ ...event, status: "cancelled" }`
  - `completeEvent(id)` → `{ ...event, status: "completed", checkedIn: true }`
  - `confirmCheckIn(id)` → `{ ...event, status: "completed" }`
  - `rejectCheckIn(id)` → `{ ...event, status: "scheduled", checkedIn: false, checkInTime: undefined, checkInLocation: undefined, checkInComments: undefined }`
- [ ] [S] Add `$pendingCheckIns` derived store: `$events.map(events => events.filter(e => e.status === "in-progress" && e.checkedIn))`
- [ ] [S] Export all new items from `features/events/index.ts` and add to `eventsModel` object
- [ ] [S] Update `specs/features/events.scenarios.ts` — add scenarios for cancel, complete, confirm, reject

---

## Phase 4 — Admin events widget fixes

> **Definition of Done**: Admin events page loads automatically, delete/edit work, hotel/musician selects use real store data, cancel and direct-complete actions are available.

- [ ] [S] Add `useEffect` to `widgets/admin-events/ui.tsx` to call `eventsModel.loadEvents()`, `hotelsModel.loadHotels()`, `musiciansModel.loadMusicians()` on mount; import models from feature barrels
- [ ] [S] Add loading skeleton/spinner while `$isLoading` is true and event list is empty
- [ ] [M] Wire delete button: add `eventToDelete` state, render `AlertDialog` with event title, on confirm call `eventsModel.deleteEvent(id)` + toast
- [ ] [L] Build edit dialog:
  - `eventToEdit` state; dialog opens pre-populated
  - All fields editable: title, description, date, time, duration, hotel, musician
  - Lock `date`, `time`, `musicianId` fields when `status === "in-progress" || status === "completed"`
  - On save: run `getSchedulingConflicts({ candidate, events, ignoreEventId: eventToEdit.id })` — show inline error if conflict; else call `eventsModel.updateEvent(mergedEvent)`
- [ ] [M] Replace hardcoded `HOTELS` array with `useUnit({ hotels: hotelsModel.$hotels })` — map to select options; populate `hotelId` on create/edit
- [ ] [M] Replace hardcoded `MUSICIANS` array with `useUnit({ musicians: musiciansModel.$musicians })` — map to select options; populate `musicianId` and `musician` name on create/edit
- [ ] [S] Add "Cancelar evento" action to event rows (visible when `status !== "completed" && status !== "cancelled"`): `AlertDialog` → `eventsModel.cancelEvent(id)` + toast
- [ ] [S] Add "Marcar completado" action to event rows (visible when `status === "scheduled" || status === "in-progress"`): single `AlertDialog` → `eventsModel.completeEvent(id)` + toast
- [ ] [S] Remove local `STATUS_COLOR` / `STATUS_TEXT` constants; use `getEventStatusLabel(event)` and derive badge variant from `getCalendarEventTone(event)`

---

## Phase 5 — Manager confirmation dashboard

> **Definition of Done**: Admin events page has a "Pendientes" tab showing in-progress events with one-click confirm/reject; badge count visible on tab.

- [ ] [S] Check whether shadcn `Tabs` component is available; add if missing (`npx shadcn@latest add tabs`)
- [ ] [M] Wrap admin events widget content in `Tabs` with two tabs: "Eventos" (existing list) and "Pendientes de confirmación" (new)
- [ ] [S] Show pending count badge on "Pendientes" tab label when `$pendingCheckIns.length > 0`
- [ ] [M] Build pending tab content:
  - Reads `eventsModel.$pendingCheckIns`
  - Each row: event title, musician, hotel, check-in time, location (if present)
  - "Confirmar" button → `eventsModel.confirmCheckIn(id)` + success toast
  - "Rechazar" button → `eventsModel.rejectCheckIn(id)` + info toast
  - Empty state when no pending check-ins

---

## Phase 6 — Calendar status consistency audit

> **Definition of Done**: All status labels and badge variants in calendar widget derive from entity lib functions; no hardcoded strings for status display.

- [ ] [S] Audit `widgets/calendar/ui.tsx` — check every `Badge variant=` and status string against `getEventStatusLabel` / `getCalendarEventTone`
- [ ] [S] Verify featured event panel handles `status: "in-progress"` + `checkedIn: true` (pending confirmation) state with correct label
- [ ] [S] Verify today's events and upcoming events sidebars use `getEventStatusLabel` consistently
- [ ] [S] Fix any hardcoded status strings found during audit

---

## Phase 7 — Tests

> **Definition of Done**: `pnpm test:run` exits 0; `__tests__/features/calendar.test.ts` exists; new event actions are covered.

- [ ] [L] Create `__tests__/features/calendar.test.ts` covering:
  - `eventsOverlap`: overlapping pair, non-overlapping pair, adjacent (no overlap), same-start edge case
  - `getSchedulingConflicts`: conflict same musician; no conflict different musician; ignores cancelled events; respects `ignoreEventId`
  - `getEventsInRange`: includes start boundary, excludes end boundary, excludes out-of-range
  - `sortEventsChronologically`: sort by date then time
  - `toFullCalendarEvents`: id mapping, start/end derived correctly, classNames from status, `extendedProps.originalEvent`
  - `getCalendarSummary`: totalEvents, completedEvents, hotelCount, estimatedHours rounding
- [ ] [M] Update `__tests__/features/events.test.ts` — add tests for `cancelEvent`, `completeEvent`, `confirmCheckIn`, `rejectCheckIn`, `$pendingCheckIns`
- [ ] [S] Update `__tests__/features/check-in.test.ts` — assert full event merge (original fields preserved after check-in)
- [ ] [S] Final `pnpm test:run` — all tests pass, exit 0

---

## Dependencies

```
Phase 1 → must complete before Phase 7 (tests rely on working test runner)
Phase 2 → must complete before Phase 3 (check-in flow informs confirmation model)
Phase 3 → must complete before Phase 4 (admin widget uses new events) and Phase 5 (dashboard uses $pendingCheckIns)
Phase 4 → independent of Phase 5 (tabs wrap existing content)
Phase 6 → independent, can run any time after Phase 3
Phase 7 → depends on all prior phases
```

## Complexity Summary

| Phase | S tasks | M tasks | L tasks | Total |
|---|---|---|---|---|
| 1 — Test infra | 5 | 0 | 0 | 5 |
| 2 — Check-in merge | 2 | 1 | 0 | 3 (+ 1 test update) |
| 3 — New actions | 3 | 1 | 0 | 4 (+ 1 scenario update) |
| 4 — Admin CRUD | 4 | 3 | 1 | 8 |
| 5 — Confirm dashboard | 2 | 2 | 0 | 4 |
| 6 — Status audit | 4 | 0 | 0 | 4 |
| 7 — Tests | 2 | 1 | 1 | 4 |
| **Total** | **22** | **8** | **2** | **32** |
