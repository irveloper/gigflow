# Plan: Event Payments & Reports

## Architecture Overview

**Approach: `paymentStatus` + `paymentNotes` on `Event`, no new model.**

Each event maps 1:1 to one payment obligation. Adding two columns to `Event` is the minimum change that satisfies the full spec without a premature abstraction. A dedicated `Payment` model would be needed only if partial payments, multiple installments, or payment history are required — all out of scope.

**Mutation flow:**
- Manager clicks "Mark as Paid" → `events.updatePaymentStatus` tRPC mutation (managerProcedure) → Prisma update + audit log write → UI updates optimistically in the client.

**Data flow for Pagos tab:**
- `reports.payments` tRPC procedure returns all non-cancelled events in the date range with payment fields. Client-side filter handles Todos / Pendiente / Pagado tabs without extra round-trips (acceptable for MVP org sizes).

**Audit log:**
- `PAYMENT_STATUS_CHANGED` added to `EventAuditLogActionSchema`. Written via existing `writeEventAuditEntry` helper in `src/server/lib/audit.ts`. Metadata: `{ from, to, notes }`.

**Musician read-only badge:**
- `paymentStatus` flows through the `EventSchema` (already fetched for musician views). Add badge to `src/widgets/event-list/ui.tsx` (`TodayEventsCard`) — visible to musicians for their own events, no actions.

---

## Implementation Phases

### Phase 1 — Data Model

**Goal:** Add `paymentStatus` and `paymentNotes` to Event in the DB and type layer.

**Steps:**

1. **`prisma/schema.prisma`** — add two fields to `Event`:
   ```prisma
   paymentStatus String  @default("pending")  // "pending" | "paid"
   paymentNotes  String?
   ```

2. **Migration file** — `prisma/migrations/20260522000001_event_payment_status/migration.sql`:
   ```sql
   ALTER TABLE "Event" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'pending';
   ALTER TABLE "Event" ADD COLUMN "paymentNotes" TEXT;
   ```

3. **`src/entities/event-audit-log/schema.ts`** — add `"PAYMENT_STATUS_CHANGED"` to `EventAuditLogActionSchema`.

4. **`src/entities/event/schema.ts`** — add `PaymentStatusSchema` and extend `EventSchema`:
   ```ts
   export const PaymentStatusSchema = z.enum(["pending", "paid"])
   // Add to EventSchema:
   paymentStatus: PaymentStatusSchema.default("pending"),
   paymentNotes: z.string().nullable().optional(),
   ```

5. **`src/specs/fixtures/events.ts`** — add `paymentStatus: "pending"` to all event fixtures. Set `paymentStatus: "paid"` on `completedLatinJazz` and `pastBoleros` to cover the paid state in tests.

6. **`src/specs/features/payments.scenarios.ts`** — new scenario file covering:
   - Default status is `pending` on creation
   - Manager marks event as paid → status becomes `paid`, audit entry written
   - Manager reverts paid → status becomes `pending`, audit entry written
   - Cancelled events excluded from payment list
   - Null-price events appear in list but excluded from KPI sums
   - Overdue: pending event with past date is flagged as vencido (derived)
   - Musician sees read-only paymentStatus on their own events

---

### Phase 2 — Server Layer

**Goal:** Expose payment mutation and payments query via tRPC.

**Steps:**

7. **`src/server/routers/events.ts`** — add `updatePaymentStatus` procedure:
   - Input: `{ eventId: z.string(), paymentStatus: PaymentStatusSchema, paymentNotes: z.string().optional() }`
   - Guard: `managerProcedure` (manager-only)
   - Fetch existing event (assert org ownership)
   - Update `paymentStatus` + `paymentNotes` via Prisma
   - Write audit entry: action `PAYMENT_STATUS_CHANGED`, metadata `{ from: existing.paymentStatus, to: input.paymentStatus, notes: input.paymentNotes ?? null }`
   - Return updated event

8. **`src/server/routers/reports.ts`** — add `payments` procedure:
   - Input: same `{ from, to }` as `summary`
   - `orgProcedure` (all org members can read)
   - Query: non-cancelled events in range, select `{ id, title, date, hotel, musician, band, sets, price, paymentStatus, paymentNotes, musicianId, bandId, hotelId }`
   - Return: event list + two aggregates: `pendingTotal` (sum of price where paymentStatus=pending and price≠null), `paidTotal` (sum of price where paymentStatus=paid and price≠null)

9. **`src/server/routers/reports.ts`** — update `summary` procedure:
   - Change `totalPayout` to reflect only `pending` events (rename to `pendingPayout` in the returned shape)
   - Add `paidPayout` alongside it for completeness

---

### Phase 3 — UI Layer

**Goal:** Pagos tab, updated KPI card, musician badge.

**Steps:**

10. **`src/app/(authenticated)/reports/page.tsx`** — five changes:
    - **KPI card**: rename "Pago Estimado" → "Por cobrar", wire to `data?.kpis.pendingPayout` (pending only).
    - **Tab list**: change `grid-cols-4` → `grid-cols-5`, add `<TabsTrigger value="pagos">Pagos</TabsTrigger>`.
    - **`SummaryData` type**: update to include `paymentSummary` from `reports.payments` call.
    - **Fetch**: add a second tRPC call `trpc.reports.payments.query({ from, to })` alongside `summary`. Store in `paymentsData` state.
    - **Pagos tab content** (`<TabsContent value="pagos">`):
      - Two KPI cards: "Por cobrar" (pendingTotal) and "Cobrado" (paidTotal)
      - Status filter toggle: Todos / Pendiente / Pagado (client-side state)
      - Table/list of payment rows with columns: Fecha, Hotel, Artista, Sets, Monto, Estado, Acciones
      - Each Pendiente row: green "Marcar como Pagado" button + optional notes input
      - Each Pagado row: small grey "Revertir" link
      - Vencido badge: shown on Pendiente rows where `event.date < today`
      - Role check: read `session.user.role` (available via `useSession`) — hide action buttons for non-managers

11. **`src/widgets/event-list/ui.tsx`** — add payment status badge to event cards:
    - Import `Badge` (already used)
    - For each event, if `event.paymentStatus` is present, render a small badge: "Pendiente" (yellow) or "Pagado" (green)
    - No action buttons — display only

---

### Phase 4 — Tests

**Goal:** Test coverage matching scenarios.

**Steps:**

12. **`src/__tests__/features/payments.test.ts`** — new test file mirroring `payments.scenarios.ts`:
    - Test `updatePaymentStatus` mutation: marks paid, writes audit log, rejects non-managers
    - Test `reports.payments` procedure: excludes cancelled, handles null price, correct totals
    - Test overdue derivation: event with past date + pending status is flagged

13. **`src/__tests__/api/events.test.ts`** — extend with `updatePaymentStatus` API tests if the file covers router-level integration.

---

## Technical Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Prisma | Existing | Schema migration adds 2 columns to `Event` |
| tRPC `managerProcedure` | Existing | Used for mutation guard |
| tRPC `orgProcedure` | Existing | Used for payments query |
| `writeEventAuditEntry` | Existing | `src/server/lib/audit.ts` — just add new action constant |
| `EventAuditLogActionSchema` | Existing | Add `PAYMENT_STATUS_CHANGED` |
| `useSession` | Existing | Role check in Pagos tab |
| shadcn `Badge`, `Button`, `Card` | Existing | All already in use on reports page |
| `date-fns` `isBefore` | Existing | For overdue derivation in UI |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing events have no `paymentStatus` — backfill is `"pending"` by default | `@default("pending")` in Prisma + `DEFAULT 'pending'` in migration covers all existing rows without manual backfill |
| `Event.price` is nullable — summing nulls as $0 would misrepresent financials | Explicit `price !== null` filter in both backend aggregation and client KPI cards |
| Reports page is `"use client"` and fetches two tRPC calls independently | Keep calls independent; show loading skeleton per section. Avoid waterfall by firing both simultaneously |
| `managerProcedure` guard must be enforced server-side — hiding UI buttons is not enough | `updatePaymentStatus` uses `managerProcedure` which throws `UNAUTHORIZED` before any DB access |
| Optimistic UI update on mark-paid could desync if server rejects | On mutation error, invalidate / refetch `reports.payments` to restore correct server state |
| Musician badge: `paymentStatus` field must be included in all event-fetching queries used by musician views | Verify the events query in `eventsRouter` (and the model store) selects `paymentStatus` — add to select if missing |

---

## File Change Summary

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `paymentStatus`, `paymentNotes` to `Event` |
| `prisma/migrations/20260522000001_.../migration.sql` | New migration |
| `src/entities/event-audit-log/schema.ts` | Add `PAYMENT_STATUS_CHANGED` action |
| `src/entities/event/schema.ts` | Add `PaymentStatusSchema`, `paymentStatus`, `paymentNotes` to `EventSchema` |
| `src/specs/fixtures/events.ts` | Add `paymentStatus` to all fixtures |
| `src/specs/features/payments.scenarios.ts` | New file |
| `src/server/routers/events.ts` | Add `updatePaymentStatus` mutation |
| `src/server/routers/reports.ts` | Add `payments` procedure; update `summary` payout split |
| `src/app/(authenticated)/reports/page.tsx` | Add Pagos tab, update KPI card, fetch payments data |
| `src/widgets/event-list/ui.tsx` | Add read-only payment status badge |
| `src/__tests__/features/payments.test.ts` | New test file |

---

## Out of Scope

- Dedicated `Payment` model or payment history table
- Partial payments
- PDF / CSV export
- Payment reminders or notifications
- Stripe or any payment processor
