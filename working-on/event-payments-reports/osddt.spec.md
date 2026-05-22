# Spec: Event Payments & Reports

## Overview

The reports page (`/org/[slug]/reports`) becomes the source of truth for payment management. Managers need to know which events have been paid and which are still outstanding, track total income collected vs. owed, and mark payments as received — all from a single, filtered view scoped to a date range.

Today the page shows estimated payout from all non-cancelled events regardless of whether money has actually changed hands. There is no way to mark a payment as received or distinguish outstanding from collected amounts.

---

## Research Summary

- Payments currently live on `Event.price` (nullable — set at booking as sets × performer rate). No payment status exists in the data model.
- The reports page already has the correct date-range filter UI and aggregation infrastructure; it needs an additional "Pagos" tab.
- Role access: managers mutate; musicians and hotel users are read-only at most.
- Cancelled events carry no payment obligation and must be excluded from all payment views.
- Events with no price set (`null`) must not appear as "$0" — show "—" to avoid confusion.
- The project's locale is Spanish (es-MX currency formatting). All new labels must follow the same convention.

---

## Session Context

- User described this as "the source of truth to manage payments and everything."
- Payment status labels the user proposed: "incoming" (pending) and "done" (paid).
- Emphasis on making it **easy for people managing money** — minimal clicks to mark something paid, clear visual separation of outstanding vs. collected.
- Payments must be traceable to their event (hotel, performer, date, amount).

---

## Requirements

### Payment Status

1. Every event (excluding cancelled) has a payment status: **Pendiente** (pending) or **Pagado** (paid).
2. New events default to **Pendiente**.
3. A manager can change an event's payment status from Pendiente → Pagado (or back).
4. Payment status is independent of event status (check-in does not auto-pay; completion does not auto-pay).

### Payments Tab

5. The reports page gains a fifth tab: **Pagos**.
6. The Pagos tab respects the existing date-range filter (Desde / Hasta) that applies to all other tabs.
7. The tab shows a list of events with: date, hotel, performer name, number of sets, amount (or "—" if price not set), and payment status badge.
8. Cancelled events do not appear in the list.
9. Events with no price set appear in the list but the amount column shows "—".

### Filtering

10. The Pagos tab provides a filter to show: All / Pendiente only / Pagado only.
11. The filter defaults to "All" so managers see the complete picture immediately.

### Payment KPIs

12. The Pagos tab shows two summary cards at the top:
    - **Por cobrar** — sum of amounts for Pendiente events in the selected range.
    - **Cobrado** — sum of amounts for Pagado events in the selected range.
    - Events with `null` price are excluded from both sums (not counted as $0).

### Mark as Paid Action

13. Each Pendiente event row has a button to mark it as **Pagado** with a single click.
14. Each Pagado event row has a secondary action to revert it to **Pendiente** (e.g., a smaller link/button to handle mistakes).
15. Only users with the manager role can trigger these actions; the buttons are absent for all other roles.

### Overdue Indicator

16. A Pendiente event whose date is in the past is visually flagged as **Vencido** (overdue) — a badge or color difference on the row. This is informational only; no separate overdue status is stored.

### Existing KPI Update

17. The top-level "Pago Estimado" KPI card (visible across all tabs) is renamed **Por cobrar** and reflects only the sum of Pendiente event amounts in the selected range — not all non-cancelled events. This makes it a live outstanding balance rather than a theoretical estimate.

---

## Scope

### In Scope

- `paymentStatus` field on Event (`pending` | `paid`), defaulting to `pending`
- Pagos tab on the reports page with date-range filter + status filter
- Por cobrar / Cobrado summary cards
- Mark as paid / revert to pending actions (manager only)
- Overdue visual indicator (derived, no DB change)
- Updated "Pago Estimado" → "Por cobrar" KPI card
- Payment notes field (free-text per event)
- Audit log entry on every payment status change
- Musician read-only payment status badge on their own events

### Out of Scope

- Dedicated Payment model or payment history log
- Partial payments
- PDF / CSV export of payment data
- Automated payment reminders or notifications
- Stripe or any payment processor integration

---

## Acceptance Criteria

1. **Default state**: When an event is created, its `paymentStatus` is `pending`. No existing events change status automatically.
2. **Pagos tab loads**: Navigating to the reports page and clicking "Pagos" shows the event list filtered to the selected date range, excluding cancelled events.
3. **Status filter works**: Selecting "Pendiente" hides all Pagado rows; selecting "Pagado" hides all Pendiente rows; "Todos" shows both.
4. **Mark paid**: Clicking the mark-paid button on a Pendiente row immediately updates that row's badge to Pagado and moves it to the Pagado count in the summary cards. No page reload required.
5. **Revert**: Clicking revert on a Pagado row returns it to Pendiente and updates summary cards accordingly.
6. **Por cobrar card**: Shows only the sum of Pendiente events' prices (null prices excluded). Updates in real time when statuses change.
7. **Cobrado card**: Shows only the sum of Pagado events' prices. Updates in real time when statuses change.
8. **Null price**: An event with no price set shows "—" in the amount column and is excluded from both KPI card sums.
9. **Overdue badge**: A Pendiente event with a past date shows a distinct "Vencido" indicator on its row.
10. **Role guard**: A musician or hotel user sees the Pagos tab in read-only mode — no mark-paid or revert buttons are visible.
11. **Date range respected**: Changing the date range and clicking "Actualizar" refreshes the payments list and KPI cards for the new range.
12. **Top KPI updated**: The existing "Pago Estimado" card in the main KPI row reflects only Pendiente amounts (not all non-cancelled events) and is labelled "Por cobrar."

---

## Decisions

1. **Musician visibility**: Yes — musicians see a read-only payment status badge for their own events. No amounts, no actions.
2. **Audit trail**: Yes — marking paid or reverting to pending writes a `PAYMENT_STATUS_CHANGED` entry to `EventAuditLog`.
3. **Payment notes**: Yes — a free-text notes field is included in MVP (e.g., "Paid via SPEI ref 12345").
