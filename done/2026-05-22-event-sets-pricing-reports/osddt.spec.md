# Spec: Event Sets, Pricing & Reports

**Feature name**: `event-sets-pricing-reports`
**Date**: 2026-05-22

---

## Overview

When creating or editing an event, the admin currently selects a "duration" in minutes — an abstract number with no business meaning. This feature replaces that concept with **sets**: a clear, domain-aligned unit where **1 set = 1 hour of performance**.

Sets serve a dual purpose:
1. **Transparent pricing** — the cost of an event is automatically calculated as `performer rate per set × number of sets`. This eliminates manual price entry and prevents errors.
2. **Real financial reports** — the reports page currently shows completely fake numbers. Once pricing is set-based, the platform can show accurate figures: what musicians earn per event, what hotels are charged per event, and how these totals trend over time.

---

## Session Context

From the user's description:
- "Sets" is the preferred term (over "duration"), with the explicit rule: **1 set = 1 hour**.
- Sets directly determine what the organization **pays to musicians/bands**.
- The same figure is used to **charge hotels** for hosting the event.
- Reports should make these two financial views clear and useful — not just event counts.
- The 90-minute duration option currently in the system does not fit the 1-set-per-hour model; this spec resolves that by dropping it (see Scope).

---

## Research Summary

Key findings from `osddt.research.md`:
- `durationMinutes` (Int) is used in scheduling overlap detection, calendar rendering, time labels, and the calendar summary — all time-based calculations must remain correct after the change.
- `hourlyRate` on Musician is conceptually identical to a "price per set" — the rename is semantic, the math is unchanged.
- Band has no pricing field today; this must be added.
- The entire reports page uses hardcoded mock data — it needs to be replaced with real aggregated queries.
- No hotel billing model exists; hotel cost visibility is purely report-level (no invoices in scope).
- The `price` field on Event is currently set manually or left null — this becomes the auto-calculated cost.

---

## Requirements

### 1. Sets on Events

- When creating or editing an event, the admin selects the number of sets (whole numbers: 1, 2, 3, 4…).
- The maximum number of sets per event is 12.
- Sets are displayed as "X set" (singular) or "X sets" (plural) wherever duration was previously shown.
- The event end time displayed in the UI is derived from the number of sets (start time + sets × 1 hour).
- The system must correctly prevent scheduling conflicts using sets-based duration (same accuracy as before).
- The 90-minute option is removed; no partial sets exist. Events previously recorded at 90 minutes are migrated to 2 sets.

### 2. Performer Rate per Set

- Each musician has a **rate per set** (replacing the previous "hourly rate"). The value and meaning are the same — it is the amount earned for one set (one hour of performance).
- Each band has a **rate per set**. This is an explicit field set on the band, not a sum of member rates.
- When registering or editing a musician or band, the admin sets the rate per set.
- The rate per set is displayed in the musician and band management views.

### 3. Automatic Event Pricing

- When an event is created or edited, the system automatically calculates the event cost:
  `event cost = performer's rate per set × number of sets`
- This calculated cost is displayed on the event form before saving, so the admin can see it in real time.
- The calculated cost is stored on the event record.
- The admin cannot manually override the stored cost — it is always derived from sets × rate. (If the rate or sets change, the stored cost updates.)
- If a performer has no rate configured, the event cost is shown as "—" (not zero) and the admin is warned.

### 4. Financial Reports — Musician View

- The reports page shows real data (no mock values).
- The "Por Músico" (By Musician) tab displays, for each musician and band in the selected period:
  - Number of events performed
  - Total sets performed
  - Total amount to be paid (sum of event costs where that performer is assigned)
- The summary KPI "Estimated Payment" shows the total payout across all performers in the selected period.

### 5. Financial Reports — Hotel View

- The "Por Hotel" (By Hotel) tab displays, for each hotel in the selected period:
  - Number of events hosted
  - Total sets hosted
  - Total amount to charge the hotel (sum of event costs for events at that hotel)
- "What the hotel is charged" equals the event cost (performer rate × sets). There is no markup or margin tracked by the platform.

### 6. Financial Reports — Summary View

- The "Resumen General" tab shows real monthly trend data:
  - Events per month
  - Sets per month (previously "hours worked")
  - Total payout per month (sum of event costs)
- Monthly figures are derived from completed and upcoming events within the selected date range.

---

## Scope

### In scope
- Replacing `durationMinutes` with `sets` across event creation, editing, display, and scheduling logic
- Adding `pricePerSet` to Band
- Renaming `hourlyRate` → `pricePerSet` on Musician (same value, new label)
- Auto-calculating and storing event cost from sets × performer rate
- Replacing all mock data on the reports page with real aggregated queries
- Showing musician payout totals in reports
- Showing hotel charge totals in reports
- Migrating existing 90-min events to 2 sets

### Out of scope
- Invoice or billing document generation (PDFs, emails)
- Payment tracking (marking a musician as "paid")
- Hotel-facing portal or hotel billing accounts
- Org margin or markup over performer rates
- Multi-currency support
- Exporting report data to CSV/Excel
- Aggregating band cost from individual member rates (band rate is its own explicit field)

---

## Acceptance Criteria

1. **Event creation form shows "sets" selector** — dropdown offers 1–12 sets; label reads "Sets (1 set = 1 hour)"; no "90 min" option exists.
2. **Event end time is correct** — an event starting at 20:00 with 2 sets shows end time 22:00.
3. **Conflict detection still works** — two events for the same musician, overlapping via sets-based duration, are flagged as a conflict.
4. **Musician rate per set** — saving a musician with `pricePerSet: 800` and creating a 2-set event produces an event cost of 1,600.
5. **Band rate per set** — saving a band with `pricePerSet: 2000` and creating a 3-set event produces an event cost of 6,000.
6. **No manual price entry** — the event form does not expose a free-text price field; cost is read-only and derived.
7. **Missing rate warning** — creating an event with a performer who has no rate set shows a warning and stores no cost value.
8. **Reports — musician totals are real** — the Por Músico tab shows amounts that match the sum of event costs for each musician in the period; no hardcoded numbers.
9. **Reports — hotel totals are real** — the Por Hotel tab shows amounts that match the sum of event costs for events at each hotel in the period.
10. **Reports — summary chart is real** — the monthly trend chart reflects actual DB data, not the same numbers every month.
11. **90-min migration** — any event that previously had `durationMinutes: 90` now has `sets: 2`; its displayed time range reflects 2 hours.
12. **"Sets" label is consistent** — everywhere the system previously showed "duration" or "minutes", it now shows "sets" (or the equivalent plural form).

---

## Decisions

1. **Band rate**: Explicit `pricePerSet` field on Band — bands set their own package rate independent of member musicians.
2. **Cost lock-in**: Event cost locks at booking time. If the performer's rate changes later, existing event costs are unaffected.
3. **Missing rate**: Block — cannot save an event if the assigned performer has no `pricePerSet` configured.
4. **Reports period selector**: Custom date range picker (start date + end date).
5. **"Horas Trabajadas" label**: Rename to "Sets Realizados" for consistency with the new terminology.
