# Research: Calendar & Events Feature Completeness

**Date**: 2026-04-24  
**Branch**: main  
**Topic**: Audit current calendar/events UX against expected feature set for this domain; identify gaps.

---

## Codebase Findings

### What exists

#### Schema (`entities/event/schema.ts`)
Rich, complete Zod schema:
- `id`, `title`, `description`
- `date` (YYYY-MM-DD), `time` (HH:MM), `durationMinutes`
- `hotel` (display), `hotelId` (relation), `musician` (display), `musicianId` (relation)
- `status`: `scheduled | in-progress | completed | cancelled`
- `checkedIn`, `checkInTime`, `checkInPhoto`, `checkInLocation`, `checkInComments`

#### Entity lib (`entities/event/lib.ts`)
Solid set of pure functions:
| Function | Purpose |
|---|---|
| `filterEventsForCalendar` | Role-based filter (musician sees only own events) |
| `getEventStartDate` / `getEventEndDate` | Date math from date+time+durationMinutes |
| `getEventTimeLabel` | "HH:MM - HH:MM" display string |
| `getCalendarEventTone` | CSS class from status/checkedIn |
| `getEventStatusLabel` | Spanish label for status |
| `toFullCalendarEvents` | Maps domain events → FullCalendar `EventInput[]` |
| `eventsOverlap` | Temporal overlap check |
| `getSchedulingConflicts` | Conflict detection per musician |
| `hasSchedulingConflict` | Boolean wrapper |
| `rescheduleEvent` | Mutates date/time from a Date object |
| `getEventsInRange` | Date range filter (exclusive end) |
| `sortEventsChronologically` | Stable sort by date+time |
| `getCalendarSummary` | Stats: totalEvents, completedEvents, hotelCount, estimatedHours |

#### Feature model (`features/events/model.ts`)
Events: `loadEvents`, `eventCreated`, `updateEvent`, `deleteEvent`  
Effects: `loadEventsFx` (500ms mock delay, returns `allEvents`)  
Stores: `$events`, `$isLoading`, `$todayEvents`, `$upcomingEvents` (derived)

#### Calendar widget (`widgets/calendar/ui.tsx`)
Full FullCalendar integration (FullCalendar v6):
- Views: `dayGridMonth`, `timeGridWeek`
- Event click → featured detail panel (right sidebar)
- Drag-to-reschedule with conflict detection (manager only, editable)
- Role-based filtering applied before render
- Summary stats strip (total, check-ins, hotels, estimated hours)
- "Today's events" sidebar list (clickable)
- "Upcoming events" sidebar list (top 5, clickable)
- Featured event panel with full detail + check-in link for musicians
- Event detail dialog on click
- Spanish locale (`@fullcalendar/core/locales/es`)
- Custom event chip render (time + title + hotel in week view)
- `dayMaxEventRows=3` with moreLinkHint
- Time slots 08:00–24:00, scrollTime 17:00
- `eventDurationEditable=false` (no stretch)
- Toast feedback on reschedule / conflict

#### Admin events widget (`widgets/admin-events/ui.tsx`)
- Create dialog with conflict detection before submit
- Stats cards: total, today count, active musicians, hotels
- Event list with status badge and check-in time
- **HARDCODED** hotel and musician lists (not from `$hotels`/`$musicians` stores)
- Edit button present but **no click handler / no update dialog**
- Delete button present but **`eventsModel.deleteEvent` never called**
- **No `useEffect` to load events** — store starts empty, list never populates on page load

#### Check-in widget (`widgets/check-in-form/ui.tsx`)
- Photo upload (JPEG/PNG, 5MB limit, `capture="environment"` for mobile camera)
- GPS location capture via `navigator.geolocation`
- Comments textarea (optional)
- Time proximity warning (±60 min from event start)
- Guard: shows "already checked in" if `event.checkedIn` is true
- On submit: calls `submitCheckIn` and navigates to `/`

#### Check-in model (`features/check-in/model.ts`)
- `submitCheckIn` event → `checkInFx`
- `checkInFx` **does NOT update `$events`** — `event.checkedIn` stays `false` in store after submit

#### Scenarios coverage
- `calendarScenarios`: visibility filter + FullCalendar adapter mapping
- `eventsScenarios`: loading, derived stores, check-in reference, CRUD, scheduling conflicts
- **No scenario for**: rescheduling drag result, cancellation, status transitions, admin edit/delete

#### Tests
- `__tests__/features/events.test.ts` — 6 tests (loading, derived, CRUD) ✓
- **No `__tests__/features/calendar.test.ts`** (entity lib functions untested)
- Timing issue: `musicians.test.ts` + `notifications.test.ts` — 5 tests timeout (allSettled hang)

---

## Key Insights

### What works well
1. Schema is rich and extensible — all domain concepts modeled
2. Entity lib is pure and well-separated — easy to test
3. Calendar widget has high UX quality: drag-reschedule, conflict detection, role filtering, Spanish i18n
4. Check-in flow is realistic: photo + GPS + time guard

### What is broken / incomplete

#### Critical bugs
| Issue | Location | Impact |
|---|---|---|
| Check-in does NOT update `$events.checkedIn` | `features/check-in/model.ts` | After check-in, event shows as unchecked in calendar |
| Admin events does NOT load events on mount | `widgets/admin-events/ui.tsx` | Admin page always shows empty list |
| Admin delete button has no handler | `widgets/admin-events/ui.tsx` | Delete is non-functional |
| Admin edit button has no handler/dialog | `widgets/admin-events/ui.tsx` | Edit is non-functional |

#### Missing features
| Feature | Gap |
|---|---|
| Admin CRUD: real hotel/musician selects | Hardcoded lists instead of `$hotels`/`$musicians` stores |
| Status transitions | No manager action to mark event "completed" or "cancelled" |
| Event cancellation flow | Schema has `cancelled` status but no UI trigger |
| Calendar date click → create event | No `dateClick` handler on FullCalendar |
| Event filter/search on calendar | No filter by status, hotel, musician, date range |
| Dedicated event detail route | No `/events/[id]` page |
| "More events" click behavior | dayMaxEventRows=3 but click target not configured |
| Admin events: pagination | Full list rendered at once, no limit |

#### Test gaps
| Missing test | Scenario file exists? |
|---|---|
| Entity lib functions (overlap, conflict, range, sort) | Scenarios in `eventsScenarios.scheduling` |
| Calendar scenarios (visibility filter, adapter) | `calendarScenarios` exists, no test file |
| Check-in effect updating `$events` | `eventsScenarios.checkIn` exists |
| Admin CRUD (edit, delete, load-on-mount) | `eventsScenarios.crud` |
| Timeout bug in musicians + notifications tests | — |

---

## Constraints & Risks

- `FullCalendar` is a heavy dependency — keep all FC logic inside `widgets/calendar/`; never leak FC types to entities or features
- `date-fns` used throughout — ensure no mixing of `date-fns` and native Date ops
- `$events` store is shared between calendar widget, admin widget, check-in page — mutations from any feature affect all views; must test for regression
- Hardcoded hotel/musician arrays in admin-events will diverge from actual `$hotels`/`$musicians` stores as data grows; removing hardcoding is a prerequisite for any musician management work
- All times are local (no timezone stored); time proximity warning in check-in is fragile if hotel is in a different timezone than device

---

## Open Questions

1. **Status transition ownership**: Should the manager explicitly mark events "completed", or should this be automatic when `checkedIn=true`? Currently `getEventStatusLabel` treats `checkedIn=true` as "completed" for display but `status` field stays `"scheduled"`.
2. **Event edit scope**: Can managers edit date/time (requiring conflict re-check), or only title/description? Rescheduling via drag exists on calendar — should it also exist in admin form?
3. **Calendar create flow**: Should clicking an empty date on the calendar open the admin create dialog (manager only), or is the admin panel the only create surface?
4. **Fixtures date anchor**: Fixtures use D(offset) relative to 2026-04-21 (hardcoded). `$todayEvents` uses `new Date()`. Will diverge as time passes. Should fixtures be relative to `Date.now()`?
5. **Check-in photo storage**: Currently `File` object is passed to the effect but nothing stores it. Is this intentional (photo upload to real backend later), or should we at least store a preview URL in the store?
6. **Test timeout root cause**: `allSettled(event, { scope })` hangs for `musicians` and `notifications` loading tests. Worth investigating before adding more tests that use the same pattern.
