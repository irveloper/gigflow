# Tasks: Event Payments & Reports

## Phase 1 — Data Model

> **Goal:** DB schema, Zod types, fixtures, and scenarios in place before any server or UI code.
> **Definition of Done:** `pnpm test:run` passes with new fixtures; `prisma validate` succeeds; `PaymentStatusSchema` exported from entities.

- [x] [S] Add `paymentStatus String @default("pending")` and `paymentNotes String?` to `Event` in `prisma/schema.prisma`
- [x] [S] Create migration `prisma/migrations/20260522000001_event_payment_status/migration.sql` with ALTER TABLE statements
- [x] [S] Add `"PAYMENT_STATUS_CHANGED"` to `EventAuditLogActionSchema` in `src/entities/event-audit-log/schema.ts`
- [x] [S] Add `PaymentStatusSchema = z.enum(["pending", "paid"])`, `paymentStatus`, and `paymentNotes` to `EventSchema` in `src/entities/event/schema.ts`
- [x] [S] Add `paymentStatus: "pending"` to all fixtures in `src/specs/fixtures/events.ts`; set `paymentStatus: "paid"` on `completedLatinJazz` and `pastBoleros`
- [x] [M] Create `src/specs/features/payments.scenarios.ts` with scenarios for: default pending on create, mark paid, revert to pending, cancelled excluded, null-price excluded from KPI sums, overdue derivation, musician read-only visibility

---

## Phase 2 — Server Layer

> **Depends on:** Phase 1 complete (schema + Zod types must exist)
> **Goal:** tRPC mutation and query wired, audit log entries written.
> **Definition of Done:** `reports.payments` returns correct data; `updatePaymentStatus` updates DB and writes audit entry; non-managers get UNAUTHORIZED.

- [x] [M] Add `updatePaymentStatus` mutation to `src/server/routers/events.ts`:
  - Input: `{ eventId, paymentStatus, paymentNotes? }`
  - Guard: `managerProcedure`
  - Fetch event, assert org ownership, update Prisma, write `PAYMENT_STATUS_CHANGED` audit entry (metadata: `{ from, to, notes }`)
  - Return updated event
- [x] [M] Add `payments` procedure to `src/server/routers/reports.ts`:
  - Input: `{ from, to }` (same as `summary`)
  - Guard: `orgProcedure`
  - Query non-cancelled events in range with payment fields selected
  - Compute `pendingTotal` and `paidTotal` (null prices excluded from sums)
  - Return event list + totals
- [x] [S] Update `summary` procedure in `src/server/routers/reports.ts`:
  - Split `totalPayout` into `pendingPayout` (pending events only) and `paidPayout`
  - Keep `totalPayout` or remove — update return shape and update the type alias in the page

---

## Phase 3 — UI Layer

> **Depends on:** Phase 2 complete (tRPC procedures must exist for type inference)
> **Goal:** Pagos tab live, KPI card updated, musician badge added.
> **Definition of Done:** Manager can view Pagos tab, filter by status, mark paid/revert in one click, see Vencido badges on overdue rows; musician sees read-only badge on event cards.

- [x] [S] Update KPI card in `src/app/(authenticated)/reports/page.tsx`: rename "Pago Estimado" → "Por cobrar", wire to `pendingPayout` from updated `summary`
- [x] [S] Add `paymentData` state + fire `trpc.reports.payments.query({ from, to })` alongside existing `summary` call in `fetchReport`
- [x] [S] Add fifth tab trigger `<TabsTrigger value="pagos">Pagos</TabsTrigger>` and update `grid-cols-4` → `grid-cols-5` in tab list
- [x] [L] Build Pagos tab content (`<TabsContent value="pagos">`):
  - Two KPI cards: "Por cobrar" (pendingTotal) and "Cobrado" (paidTotal)
  - Client-side status filter toggle: Todos / Pendiente / Pagado
  - Event table: Fecha, Hotel, Artista, Sets, Monto (or "—"), Estado badge, Acciones
  - Vencido badge on Pendiente rows with past dates (`isBefore(parseISO(event.date), today)`)
  - "Marcar como Pagado" button per Pendiente row (manager only) with optional notes textarea
  - "Revertir" link per Pagado row (manager only)
  - Role check via `useSession()` — hide action buttons for non-managers
  - Optimistic UI update on action; refetch on error
- [x] [S] Add read-only `paymentStatus` badge to event cards in `src/widgets/event-list/ui.tsx` (shown for all roles, no actions)
- [x] [S] Verify events router `select` includes `paymentStatus` and `paymentNotes` so musician views receive the field

---

## Phase 4 — Tests

> **Depends on:** Phases 1–3 complete
> **Goal:** Test coverage for all payment scenarios.
> **Definition of Done:** `pnpm test:run` passes with no skipped payment tests.

- [x] [M] Create `src/__tests__/features/payments.test.ts` mirroring `payments.scenarios.ts`:
  - `updatePaymentStatus`: marks paid, writes audit log entry, rejects non-manager with UNAUTHORIZED
  - `reports.payments`: excludes cancelled events, handles null price correctly, returns correct pendingTotal/paidTotal
  - Overdue derivation: pending event with past date is present in list (UI derives vencido client-side — test the data shape)
- [x] [S] Extend `src/__tests__/api/events.test.ts` with `updatePaymentStatus` router-level test if the file covers router integration

---

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
              ↑
        (tRPC types needed for page type inference)
```

Phase 3 Step "Add fifth tab + Pagos content" can begin once `reports.payments` procedure exists (type inference for the query return type).

Phase 3 "Musician badge" is independent of the Pagos tab — can be done in parallel with Pagos tab work.

## Notes

- Run `pnpm prisma generate` after schema change before starting Phase 2.
- The `SummaryData` type alias at the top of `reports/page.tsx` (`type SummaryData = Awaited<ReturnType<typeof trpc.reports.summary.query>>`) will need a companion `PaymentsData` type alias once the procedure exists.
- All new Spanish UI labels: "Pagos", "Pendiente", "Pagado", "Vencido", "Por cobrar", "Cobrado", "Marcar como Pagado", "Revertir", "Todos".
