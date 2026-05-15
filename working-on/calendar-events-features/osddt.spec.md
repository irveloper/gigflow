# Spec: Calendar & Events Feature Completeness

**Date**: 2026-04-24  
**Feature**: `calendar-events-features`  
**Status**: Draft

---

## Overview

The calendar/events system lets musicians see and manage their scheduled performances, and managers create, edit, and cancel events across hotels. The core domain is working, but several user-facing behaviors are broken or absent: check-in does not persist in the store, the admin events panel never loads data and cannot edit or delete, the admin form uses hardcoded data instead of the real hotel and musician rosters, and there is no way to mark an event as cancelled or completed from the UI.

This spec covers what must be fixed and what gaps must be filled so the calendar and event management surface is correct and complete for the two primary roles: **musician** and **manager**.

---

## Research Summary

From `osddt.research.md`:

- Schema and entity lib are solid. All domain concepts (status, check-in metadata, scheduling overlap) are already modeled.
- Calendar widget UX is high quality: drag-reschedule, conflict detection, role filtering, Spanish locale, summary stats.
- Check-in widget collects photo, GPS, and comments correctly, but the submitted data never updates the event's `checkedIn` field in the shared store — so the calendar and today's events list still show the event as unchecked after submission.
- Admin events widget never calls `loadEvents` on mount, so the list is always empty when navigating to the page.
- Admin delete and edit buttons exist in the UI but have no actions wired — they are non-functional.
- Hotel and musician selects in the admin create form are hardcoded arrays, not derived from the real `$hotels` / `$musicians` stores.
- No UI exists to cancel an event or mark it completed from the manager side.
- Entity lib scheduling functions are untested; no calendar-specific test file exists.
- Five tests in the musicians and notifications loading suites time out consistently.

---

## Requirements

### R1 — Check-in persists in the event store

After a musician completes a check-in, the corresponding event in the shared store must reflect `checkedIn: true` and `checkInTime` set to the submission timestamp. The calendar and today's events sidebar must immediately show the updated state without a page reload.

### R2 — Admin events panel loads on mount

When a manager navigates to `/admin/events`, the event list must be populated automatically. The panel must not require a manual action to show events.

### R3 — Admin event deletion works

Clicking the delete button on an event row must remove that event from the store and from every view that renders events (calendar, today list, upcoming list). A confirmation step must prevent accidental deletion.

### R4 — Admin event editing works

Clicking the edit button on an event row must open a pre-populated form. Saving must update the event in the store. Conflict detection must re-run against the new date/time/musician before the update is applied.

### R5 — Admin create form uses real rosters

The hotel and musician dropdowns in the create (and edit) form must be populated from the live `$hotels` and `$musicians` stores, not from hardcoded arrays. The musician's `id` and `name` must be sourced from the store so the event's `musicianId` is consistent with fixture and real data.

### R6 — Manager can cancel an event

A manager must be able to cancel any event that is not already completed. Cancellation must set `status: "cancelled"`. Cancelled events must be visually distinct on the calendar and in all lists. Cancellation must require explicit confirmation.

### R7 — Manager confirmation dashboard for check-ins

After a musician submits a check-in, the event enters a pending state (`status: "in-progress"`, `checkedIn: true`). Managers must have a dashboard surface (a dedicated section or page) that lists all pending check-in requests. From there a manager can:
- **Confirm** → sets `status: "completed"` (no further dialog needed)
- **Reject** → resets `status: "scheduled"` and `checkedIn: false`

### R8 — Manager can mark an event as completed directly

A manager must be able to mark a scheduled or in-progress event as completed without going through the musician check-in flow. This sets `status: "completed"` and `checkedIn: true` immediately, with a single confirmation step.

### R8 — Status displayed consistently across all views

The status label and visual treatment (badge color) must be consistent between the calendar chip, the featured event panel, the today/upcoming sidebars, and the admin events list. The source of truth is `getEventStatusLabel` and `getCalendarEventTone` from the entity lib.

### R9 — Test timeout bug is fixed

The five timing-out tests in `musicians.test.ts` and `notifications.test.ts` must pass reliably within the standard 5 000 ms timeout. No test should require a timeout override to pass.

---

## Scope

### In scope

- Fix check-in effect so it updates `$events` on success (`status: "in-progress"`, `checkedIn: true`)
- Manager confirmation dashboard: list pending check-ins, confirm → completed, reject → reset
- Fix admin events panel: load on mount, wire delete, build full edit dialog (with date/time lock for in-progress/completed)
- Replace hardcoded hotel/musician arrays in admin form with store-driven selects
- Add cancellation action (manager only, with confirmation)
- Add direct "mark completed" action (manager only, no approval needed)
- Fix fixture date anchor to `Date.now()`-relative
- Fix test timeout bug in musicians and notifications loading tests
- Add `__tests__/features/calendar.test.ts` covering entity lib functions (overlap, conflict, range, sort) and FullCalendar adapter mapping

### Out of scope

- Dedicated `/events/[id]` detail page (no ticket, no demand)
- Calendar `dateClick` → create event from calendar view
- Filter / search UI on the calendar page
- Pagination on the admin events list
- Real backend / photo storage (stays mock/client-only)
- Timezone support
- Any change to the check-in photo capture flow beyond persisting the result

---

## Acceptance Criteria

### Check-in
- AC1.1: After submitting a check-in, `$events` contains the updated event with `checkedIn: true` and `checkInTime` matching the submission timestamp.
- AC1.2: The calendar widget shows the updated status chip immediately without a page reload.
- AC1.3: If the event was in `today's events`, the status badge updates to "Check-in completo".

### Admin events — load
- AC2.1: Navigating to `/admin/events` shows the full event list without any manual action.
- AC2.2: A loading skeleton or spinner is shown while the fetch is in progress.

### Admin events — delete
- AC3.1: Clicking delete shows a confirmation dialog naming the event.
- AC3.2: Confirming removes the event from `$events` and from every rendered list.
- AC3.3: Cancelling the dialog leaves the event unchanged.

### Admin events — edit
- AC4.1: Clicking edit opens a dialog pre-populated with the event's current fields.
- AC4.2: Saving with a conflicting schedule (same musician, overlapping time) shows an error and does not update the store.
- AC4.3: Saving with valid data updates the event in `$events`.

### Admin create/edit — roster selects
- AC5.1: Hotel dropdown is populated from `$hotels`; selecting one sets `hotelId` correctly.
- AC5.2: Musician dropdown is populated from `$musicians`; selecting one sets `musicianId` and `musician` name correctly.

### Cancellation
- AC6.1: Manager sees a "Cancel event" action on any non-completed event.
- AC6.2: Confirming cancellation sets `status: "cancelled"` in `$events`.
- AC6.3: Cancelled events display in a visually distinct style (muted / strikethrough / red tone) on the calendar and in lists.
- AC6.4: The action is not visible or not available for events already `completed` or `cancelled`.

### Mark completed
- AC7.1: Manager sees a "Mark as completed" action on `scheduled` and `in-progress` events.
- AC7.2: Confirming sets `status: "completed"` and `checkedIn: true` in `$events`.

### Status consistency
- AC8.1: Badge variant, label text, and calendar chip class all derive from the same entity lib functions for all four statuses.

### Tests
- AC9.1: `pnpm test:run` passes all tests with exit code 0.
- AC9.2: No test uses a custom timeout override to compensate for the hang.
- AC9.3: `__tests__/features/calendar.test.ts` exists and covers: `eventsOverlap`, `getSchedulingConflicts`, `getEventsInRange`, `sortEventsChronologically`, `toFullCalendarEvents`, `getCalendarSummary`.

---

## Decisions

1. **Status after check-in**: Musician check-in sets `checkedIn: true` and `status: "in-progress"` (pending manager confirmation). A new manager confirmation dashboard shows pending requests. Manager confirms → `status: "completed"`; manager rejects → resets to `status: "scheduled"`, `checkedIn: false`. Manager marking directly (without musician check-in) sets `status: "completed"` immediately with no approval step.

2. **Edit scope**: Full edit dialog — all fields editable (title, description, date, time, duration, hotel, musician). Conflict re-check runs on every save. Date and time fields are read-only when `status` is `"in-progress"` or `"completed"`.

3. **Fixture date anchor**: Fix `specs/fixtures/events.ts` to use `Date.now()`-relative offsets so fixtures always reflect actual today/upcoming relative to the real current date. Tests must work without mocking `Date`.
