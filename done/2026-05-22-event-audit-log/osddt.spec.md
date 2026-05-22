# Spec: Event Audit Log

**Feature name:** `event-audit-log`
**Date:** 2026-05-22

---

## Overview

Org managers need a complete, immutable history of everything that happens to a booking — who created it, when a musician was assigned, whether the musician acknowledged the invitation, when check-in occurred, and what fields changed over time (including price). This is the **Event Audit Log**: a chronological, append-only record attached to each event.

The log is an operational transparency tool for org managers. It answers "what happened to this booking and who did it?" without requiring managers to reconstruct history from scattered notifications or email threads.

Musicians and hotel administrators must never see this log — it may contain internal pricing and operational decisions.

---

## Requirements

### R1 — Tracked actions

The system must record an audit entry whenever any of the following occurs on an event:

| Action | Trigger |
|---|---|
| Event created | Manager creates a new booking |
| Musician assigned | Musician or band is selected/changed on the event |
| Musician invitation sent | Notification dispatched to musician for the event |
| Musician read invitation | Musician marks the event-linked notification as read |
| Musician accepted booking | Musician confirms participation (if acceptance flow exists) |
| Check-in recorded | Musician or manager submits check-in (time, location, photo) |
| Check-in confirmed | Manager confirms a pending check-in |
| Check-in rejected | Manager rejects a pending check-in |
| Status changed | Event status transitions (e.g. scheduled → cancelled, → completed) |
| Field updated | Any editable field on the event changes (title, date, time, duration, hotel, description) |
| Price changed | The event price is added or modified |
| Event deleted | Event is removed from the system |

### R2 — Entry contents

Each audit entry must capture:
- **Who** acted (actor name + role; system for automated actions)
- **What** happened (human-readable action label)
- **When** it happened (timestamp, displayed in org-local timezone)
- **Detail** — a concise summary of the change (e.g. "Status changed from Scheduled to Cancelled", "Musician changed to John Doe", "Check-in at 21:03 — Hotel Grand")

### R3 — Access control

- Only users with the `manager` role within the org may view the audit log for that org's events
- A manager may only see audit logs for events belonging to their own organization
- Musicians, hotel users, and unauthenticated users must receive no access — not even a 404 that hints at the resource's existence

### R4 — Log integrity

- Audit entries are immutable — no entry may ever be edited or deleted by any user, including managers and superadmins
- Entries are always recorded server-side, regardless of how the action was triggered (UI, API, background job)

### R5 — Audit log view

- The audit log for an event is accessible from the event's admin detail page
- Entries are displayed chronologically, newest first
- The view must display: timestamp, actor name, action label, and change detail
- The list must be paginated (managers should not be forced to load thousands of entries at once)

### R6 — Band parity

- Band assignment and changes are tracked with the same fidelity as musician assignment

---

## Scope

### In scope

- New append-only audit log storage for events
- Instrumentation of all event mutations listed in R1
- Instrumentation of musician notification read events linked to an event
- Org-manager-only access, scoped to own org
- Audit log view on the event admin detail page (paginated, newest-first)
- Price field on Event (to enable R1 price tracking) — if price is not yet a field, it is added as part of this feature
- `organizationId` stored on every audit row (denormalized)

### Out of scope

- Real-time / live-updating audit log (page refresh is sufficient for MVP)
- Superadmin cross-org audit log view (deferred; data model is ready via `organizationId` column)
- Audit log export (CSV/PDF) — deferred
- Retention policy / automatic log pruning — deferred
- Audit log for non-event entities (musicians, hotels, users) — separate feature
- Distinguishing "org owner" from "all managers" — all managers have equal access for MVP
- Org-level audit log page — audit log lives on the event detail page only; deleted events take their log with them

---

## Acceptance Criteria

**AC1.** A manager visiting an event's detail page can open the audit log and see a chronological list of all changes made to that event since creation.

**AC2.** When a manager creates an event, an entry "Event created by [name]" appears immediately in the log with the correct timestamp.

**AC3.** When a musician is assigned or changed on an event, an entry "Musician assigned: [musician name]" (or "Musician changed from X to Y") appears in the log.

**AC4.** When a musician reads the event invitation notification, an entry "Musician [name] read the invitation" appears in the log.

**AC5.** When check-in is submitted, an entry "Check-in recorded at [time]" appears. When confirmed, "Check-in confirmed". When rejected, "Check-in rejected — reverted to Scheduled".

**AC6.** When any status change occurs (cancel, complete, etc.), the log shows "Status changed from [old] to [new]" with the actor's name.

**AC7.** When any other field (title, date, time, hotel, duration, description, price) is changed, the log shows "Field updated: [field] changed from [old value] to [new value]".

**AC8.** A musician who navigates to the audit log URL receives a 403 or is redirected — no log data is exposed.

**AC9.** A manager from Org A cannot view audit logs for events belonging to Org B.

**AC10.** The audit log list is paginated — loading the log for an event with hundreds of entries does not result in a single unbounded response.

**AC11.** Audit entries cannot be deleted or modified via any user-facing action or API call.

---

## Research Summary

From `osddt.research.md`:

- **Existing pattern**: `LoginAuditLog` in Prisma is append-only with actor ID, outcome, and timestamp — the direct model to follow.
- **No existing event audit table**: must be created from scratch.
- **Role guards**: `managerProcedure` in tRPC handles access control cleanly; musicians and hotel roles are already separated.
- **Instrumentation point**: event router mutations (`events.ts`) are the correct place to write audit entries — not Effector models.
- **Event deletion risk**: current pattern is hard-delete — spec resolves this by requiring event title snapshot in the log entry (AC8).
- **No price field**: price must be added to the Event model as part of this feature.
- **Notification read hook**: `markAsRead` in notifications router must filter for event-linked notifications to generate the relevant log entry.

---

## Decisions

1. **Price field default**: `null` — existing events get no price value; no "price changed" audit entry fires for legacy events.
2. **Deleted-event log access**: audit log lives on the event detail page only — no org-level or cross-event log view. If an event is deleted, its log is gone with it.
3. **Superadmin data model**: include `organizationId` as a denormalized column on every `EventAuditLog` row to enable future cross-org superadmin queries without joining through Event.
