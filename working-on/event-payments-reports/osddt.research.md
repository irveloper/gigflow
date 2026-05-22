# Research: Event Payments & Reports

## Topic

Adding payment status management (pending / paid) to the reports page at `/org/[slug]/reports`, making it the source of truth for payment tracking tied to events.

---

## Codebase Findings

### Route & Page

- URL `/org/plugin-cancun/reports` is served by `src/app/org/[slug]/reports/page.tsx`, which re-exports from `src/app/(authenticated)/reports/page.tsx`.
- Middleware (`src/middleware.ts`) automatically redirects org users from `/reports` → `/org/[slug]/reports`.
- The reports page is a `"use client"` component that fetches via `trpc.reports.summary.query({ from, to })`.

### Reports Router

**File:** `src/server/routers/reports.ts`

Single procedure: `reports.summary` — aggregates events in a date range:
- KPIs: `totalEvents`, `totalSets`, `totalPayout`, `checkInRate`
- Breakdowns: `byMusician`, `byBand`, `byHotel`, `byMonth`
- Filters out `status = "cancelled"` events
- `totalPayout` = sum of `Event.price` (nullable)

### Payment Data Today

No `Payment` model. Payments are encoded on `Event`:
- `Event.price: Float?` — set at booking time as `sets × performer.pricePerSet`
- Computed in `events.create` router — throws `BAD_REQUEST` if performer has no `pricePerSet`
- No `paymentStatus` field anywhere; money tracking is implied by `Event.status`

### Event Model (Prisma)

```
model Event {
  id              String
  price           Float?           // null = not set
  status          String           // scheduled | in-progress | completed | cancelled
  checkedIn       Boolean
  sets            Int
  musicianId      String?
  bandId          String?
  hotelId         String?
  organizationId  String           // tenant isolation
  date            String           // YYYY-MM-DD
  ...
}
```

### Event Schema (Zod)

`src/entities/event/schema.ts`

```ts
export const EventStatusSchema = z.enum(["scheduled", "in-progress", "completed", "cancelled"])
```

No `paymentStatus` in `EventSchema`.

### tRPC Procedures Available

- `orgProcedure` — any authenticated org member
- `managerProcedure` — managers only (use for payment mutations)
- `protectedProcedure` — any authenticated user

### Reports Page UI

Four tabs: Resumen General / Por Músico / Por Hotel / Reportes Automáticos.

No payments tab. No per-event payment status UI. "Reportes Automáticos" tab is stubbed out ("Próximamente").

### SDD Specs Layer

`src/specs/` has:
- `entities/` — Zod schemas (no payment schema yet)
- `features/` — scenario files (no payments scenarios file)
- `fixtures/` — typed mock data (no payment fixtures)

### Existing Event Fixtures

Events have `price` omitted from fixtures (optional). `status` ranges across all values. No payment-related fields.

---

## External References

- None required — all data lives in Postgres via Prisma

---

## Key Insights

1. **Simplest extension: add `paymentStatus` to `Event`.**
   - Each event = one payment. 1:1 mapping is valid for this MVP.
   - Avoids new Prisma model. Migration adds one column: `paymentStatus String @default("pending")`.
   - Status values: `"pending"` ("incoming") | `"paid"` ("done").
   - Reports router `summary` already queries all events — just extend to group by `paymentStatus`.

2. **The reports page already has the right date-range UX.** Add a "Pagos" tab alongside existing tabs. Show a table of events with payment status, amount, performer, hotel, date, and an action button to mark as paid.

3. **Payment totals needed:**
   - Total owed (pending payments)
   - Total collected (paid payments)
   - This replaces/enhances "Pago Estimado" KPI which currently treats all non-cancelled events as income regardless of payment status.

4. **Mutation shape:** `events.updatePaymentStatus({ eventId, paymentStatus })` — manager-only, org-scoped, simple string update.

5. **Filtering in reports summary:** Extend `reports.summary` to return per-status aggregates. Or add `reports.payments` procedure that returns a paginated list of events with payment info.

6. **Locale context:** UI is in Spanish. Labels → "Pendiente" / "Pagado". Currency → `es-MX`. Tabs are already in Spanish.

---

## Constraints & Risks

- **No dedicated Payment model** means no payment history (who changed status, when). If audit trail is needed, extend `EventAuditLog` with a `PAYMENT_STATUS_CHANGED` action (already has infrastructure in `src/server/lib/audit.ts`).
- **`Event.price` is nullable** — some old events may have `null` price. Payment UI must handle this gracefully (show "—" not "$0").
- **Cancelled events** should not show in payments view (they have no payment obligation). The existing router already excludes them.
- **Role guard:** Only managers should mark payments as paid. Musicians and hotel users should see read-only payment info if anything.
- **Prisma migration:** Adding `paymentStatus` column with `@default("pending")` is non-breaking. Backfill: completed events could be seeded as `"paid"` or stay `"pending"` — lean toward keeping them `"pending"` to force explicit confirmation.

---

## Open Questions

1. **Should completed/checked-in events auto-set `paymentStatus = "paid"`?** Or always manual? — Probably always manual: check-in ≠ payment received.
2. **Should `paymentStatus` be visible to musicians in their own view?** Probably yes (read-only) so they know if they've been paid.
3. **Do we need payment notes / reference numbers?** Not in scope for MVP — add `paymentNotes: String?` only if user confirms need.
4. **Overdue status?** Events past their date + still pending could be flagged as "overdue" — derived field, not a new DB status. Simple computed filter in UI.
5. **Pagination on payments list?** Current events list is small for MVP orgs. Can fetch all and filter client-side initially.

---

## Implementation Plan (SDD Order)

```
1. prisma/schema.prisma         — add paymentStatus String @default("pending") to Event
2. prisma/migrations/           — generate migration
3. src/specs/entities/          — add PaymentStatusSchema to event.schema.ts
4. src/entities/event/schema.ts — add paymentStatus to EventSchema
5. src/specs/fixtures/events.ts — add paymentStatus field to all event fixtures
6. src/specs/features/          — add payments.scenarios.ts
7. src/server/routers/reports.ts — add reports.payments procedure (list + totals by status)
8. src/server/routers/events.ts  — add events.updatePaymentStatus mutation (managerProcedure)
9. src/app/(authenticated)/reports/page.tsx — add "Pagos" tab with payment table + mark-paid actions
```
