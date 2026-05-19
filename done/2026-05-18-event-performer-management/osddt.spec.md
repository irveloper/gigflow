# Spec: Event Performer Management

**Feature**: `event-performer-management`  
**Date**: 2026-05-18  
**Status**: Draft

---

## Overview

Today, an event can only be assigned to a single musician. This creates two real-world problems:

1. **Bands are invisible** — if a hotel books a jazz trio for Friday night, there's no way to represent that group. The admin must pick one musician arbitrarily, losing all context about who else is performing.
2. **Solo vs. band scheduling is broken** — the same guitarist might play solo at a dinner at 6pm and then join a band at a poolside party at 9pm. The system can't express this distinction, and conflict detection would incorrectly flag it as a double-booking.

This feature introduces a **performer model** where an event is booked for either a **solo musician** or a **band** (a named group of musicians). Musicians can belong to multiple bands. The system correctly detects scheduling conflicts regardless of whether a musician is booked solo or as part of a band.

---

## Session Context

The user described the following real-world scenario motivating this feature:

> "A guitarist could play solo at the dinner (6pm) and then in the afternoon play in a band next to a pool. The same musician is in 1, 2, or 3 bands, and could have events in different bands, for different hotels."

This confirms:
- A musician can be a member of multiple bands simultaneously
- A musician can have both solo and band events on the same day — as long as the time slots don't overlap
- Bands are booked as a unit; the hotel cares about the group, not just one member
- The system must schedule and detect conflicts at both the musician level (solo) and band level (group)

---

## Research Summary

Key findings from codebase research:

- **Current model**: `Event.musicianId` (single FK) + `Event.musician` (denormalized string). One musician per event only.
- **No Band entity exists** anywhere in the codebase (schema, code, or fixtures).
- **Conflict detection** (`entities/event/lib.ts`) only compares `musicianId` — will incorrectly miss band-level conflicts and incorrectly flag solo-after-band as a double-booking.
- **Musicians can belong to multiple organizations** via `MusicianOrganization` join table — the same scoping pattern needs to apply to bands.
- **Existing events** use `musicianId`; the migration must be additive (no data loss).
- **UI**: single `<Select>` in the event creation form — needs to become a performer picker with solo/band modes.

---

## Requirements

### R1 — Band Management

1. Admins can create a **band** within their organization. A band has:
   - A name (required)
   - A list of member musicians (at least 1)
   - Optional: description, genre
2. Admins can add or remove musicians from a band.
3. A musician can be a member of multiple bands.
4. A band belongs to an organization (like musicians do). Bands from other organizations are not visible.
5. Admins can deactivate a band (it still appears on past events but cannot be booked for new ones).

### R2 — Performer Selection on Events

6. When creating or editing an event, the admin selects a **performer type**: **Solo** or **Band**.
7. **Solo mode**: the admin picks one musician from the organization's musician list (existing behaviour).
8. **Band mode**: the admin picks one band from the organization's band list.
9. Exactly one performer (solo musician or band) must be assigned per event — not both, not neither.
10. The event display shows the performer name clearly — either the musician's name or the band's name.

### R3 — Scheduling Conflict Detection

11. A musician cannot be booked in two overlapping events on the same day, regardless of whether they are performing solo or as part of a band.
    - Solo event at 6pm + band event (musician is a member) at 7pm → **conflict**
    - Solo event at 6pm + band event starting at 8:30pm (after solo ends) → **no conflict**
12. The system warns the admin at booking time if a conflict is detected for any member of a band.
13. A band as a whole cannot be double-booked (same band, overlapping time) — this is already implied by the musician-level check but must be surfaced clearly.

### R4 — Event List & Calendar Display

14. The event list and calendar correctly display the performer name (musician or band) for each event.
15. Filtering or searching events by performer name works for both solo musicians and bands.

### R5 — Backward Compatibility

16. All existing events (which have `musicianId` set) are treated as **solo** events automatically. No data migration required from the user's perspective.
17. The event detail view for legacy solo events continues to work unchanged.

---

## Scope

### In scope

- Band entity: create, edit, deactivate, manage members
- Performer picker on event creation/edit form (solo vs. band mode)
- Conflict detection that covers both solo and band memberships
- Admin UI for managing bands within an organization
- Event list/calendar display of performer name (band or solo)
- Organization-scoped bands (like musicians)

### Out of scope (v1)

- Per-event lineup variations (e.g., booking 3 of 5 band members for a specific show)
- Public-facing band profiles or musician portfolios
- Band billing or per-member rate tracking
- Cross-organization shared bands
- Musician-level availability calendar UI
- Notifications to band members when a band event is booked

---

## Acceptance Criteria

### Bands

- [ ] Admin can create a band with a name and at least one member musician
- [ ] Admin can add a musician to an existing band
- [ ] Admin can remove a musician from a band (if band still has at least 1 member)
- [ ] A musician can appear as a member of multiple bands simultaneously
- [ ] Admin can deactivate a band; deactivated bands do not appear in the event form picker
- [ ] Only bands linked to the admin's organization are shown

### Event Booking

- [ ] Event creation form shows a performer type selector: "Solo Musician" / "Band"
- [ ] Selecting "Solo" shows the existing musician picker
- [ ] Selecting "Band" shows the band picker (active bands only)
- [ ] An event cannot be saved without a performer selected
- [ ] An event cannot have both a musician and a band assigned
- [ ] The event detail view shows the performer's name correctly for both modes

### Conflict Detection

- [ ] Booking a solo musician who is already in a band event at the same time → blocked with an error message
- [ ] Booking a band whose member is already booked solo at the same time → blocked with an error message
- [ ] Booking a band whose member is already in another band event at the same time → blocked with an error message
- [ ] Booking a solo musician for a time slot after their earlier band event ends → allowed
- [ ] Booking a solo musician for a time slot at a different hotel, non-overlapping → allowed

### Existing Events

- [ ] All existing events with `musicianId` continue to display correctly as solo events
- [ ] No existing event data is lost or corrupted after the migration

---

## Decisions

1. **Band pricing**: No `hourlyRate` on Band. Pricing is always individual, tracked per-musician only. Band bookings do not generate a group cost estimate.

2. **Minimum band size**: A band must have at least 2 members. A single performer is always a Solo. The system enforces this at creation and when removing members.

3. **UI picker flow**: Toggle-first (Solo / Band), then the relevant picker appears contextually below the selection. Unambiguous and clear for admins.

4. **Conflict behavior**: Hard block. Conflicts prevent saving entirely, with a clear error message. Consistent with current solo conflict behavior.

5. **`shows` field on Musician**: Replace `shows: string[]` with two distinct fields — `instruments: string[]` (what they play, e.g. "Guitar", "Piano") and `styles: string[]` (musical genres/styles, e.g. "Jazz", "Flamenco"). Richer musician profile that also informs band member roles.

6. **Band deactivation vs. deletion**: Soft delete only across the board. Bands are deactivated, never permanently deleted. Historical event records remain intact.
