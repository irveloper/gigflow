# Plan: Event Sets, Pricing & Reports

**Feature name**: `event-sets-pricing-reports`
**Date**: 2026-05-22
**Spec decisions applied**: explicit band rate, locked-at-booking price, block-on-missing-rate, custom date range, rename to "Sets Realizados"

---

## Architecture Overview

### Core model change

`Event.durationMinutes` (Int, minutes) → `Event.sets` (Int, 1–12, where 1 set = 60 min). All time arithmetic converts internally: `sets × 60 = minutes`. No precision is lost — 90-minute events (the only fractional-set case) are rounded up to 2 sets via migration.

### Price locking

At event creation the server snapshots `performer.pricePerSet × event.sets` into `Event.price`. Subsequent changes to the performer's rate do not affect stored event prices. This is identical to the existing `price` field — it becomes auto-populated instead of manually entered.

### Reports architecture

A new `reports` tRPC router returns real aggregated data. No pre-aggregated summary table — queries run against the existing `Event`, `Musician`, `Band`, and `Hotel` tables directly. The reports page becomes a Server Component (data fetching at request time) or uses a tRPC query with the date range as input.

### Migration strategy

Additive migration:
1. Add `sets Int` column, compute from `durationMinutes` (`CEIL(durationMinutes / 60.0)`).
2. Codebase switches to `sets`.
3. Drop `durationMinutes` in a follow-up migration (or inline — the column is non-nullable so both must happen in one migration with a default or computed value).

---

## Implementation Phases

### Phase 1 — Prisma Schema & Migration

**Goal**: Update the database schema to reflect sets-based duration and per-set pricing.

Steps:
1. In `prisma/schema.prisma`:
   - Remove `durationMinutes Int` from `Event`, add `sets Int` (1–12).
   - Rename `hourlyRate Float` → `pricePerSet Float` on `Musician`.
   - Rename `hourlyRate Float?` → `pricePerSet Float?` on `User` (denormalized field).
   - Add `pricePerSet Float?` to `Band` (nullable — existing bands start without a rate).
2. Write migration SQL (`prisma/migrations/<timestamp>_event-sets-pricing/migration.sql`):
   - `ALTER TABLE "Event" ADD COLUMN "sets" INTEGER;`
   - `UPDATE "Event" SET "sets" = CEIL("durationMinutes"::float / 60);` (90 min → 2 sets)
   - `ALTER TABLE "Event" ALTER COLUMN "sets" SET NOT NULL;`
   - `ALTER TABLE "Event" DROP COLUMN "durationMinutes";`
   - `ALTER TABLE "Musician" RENAME COLUMN "hourlyRate" TO "pricePerSet";`
   - `ALTER TABLE "User" RENAME COLUMN "hourlyRate" TO "pricePerSet";`
   - `ALTER TABLE "Band" ADD COLUMN "pricePerSet" DOUBLE PRECISION;`
3. Update `prisma/seed.ts`: replace `location` with structured address fields (pre-existing build error), replace `hourlyRate` with `pricePerSet`, replace `durationMinutes` with `sets`.

**Files**: `prisma/schema.prisma`, `prisma/migrations/<new>/migration.sql`, `prisma/seed.ts`

---

### Phase 2 — Zod Schemas (Spec Layer)

**Goal**: Update the single source of truth for types.

Steps:
1. `src/entities/event/schema.ts`:
   - Replace `const DurationMinutes = z.number().int().positive().max(12 * 60)` with `const Sets = z.number().int().min(1).max(12)`.
   - Replace `durationMinutes: DurationMinutes` with `sets: Sets` in `EventSchema`.
   - Remove `price` from `CreateEventInputSchema` (it is now server-calculated, not user-provided). Mark it read-only / omit from create input.
2. `src/entities/musician/schema.ts`:
   - Rename `hourlyRate` → `pricePerSet` in `MusicianSchema`.
3. `src/entities/band/schema.ts`:
   - Add `pricePerSet: z.number().positive().optional()` to `BandSchema`.
   - Add `pricePerSet` to `CreateBandInputSchema`.
4. `src/specs/fixtures/events.ts`: update all `durationMinutes` values to `sets` (60 min → 1, 90 min → 2, 120 min → 2, 180 min → 3).
5. `src/specs/fixtures/musicians.ts`: rename `hourlyRate` → `pricePerSet`.
6. `src/specs/fixtures/bands.ts` (if exists): add `pricePerSet` to band fixtures.

**Files**: `src/entities/event/schema.ts`, `src/entities/musician/schema.ts`, `src/entities/band/schema.ts`, `src/specs/fixtures/events.ts`, `src/specs/fixtures/musicians.ts`

---

### Phase 3 — Domain Logic (Event lib)

**Goal**: Update all time-arithmetic helpers to use `sets`.

Steps:
1. `src/entities/event/lib.ts`:
   - `getEventEndDate`: change `Pick<Event, "date" | "time" | "durationMinutes">` → `Pick<Event, "date" | "time" | "sets">`, compute `addMinutes(start, event.sets * 60)`.
   - `getEventTimeLabel`: update Pick type to `sets`.
   - `eventsOverlap`: update Pick type to `sets`.
   - `getCalendarSummary`: replace `event.durationMinutes / 60` accumulator with `event.sets`; rename result key `estimatedHours` → `totalSets`.
   - `toFullCalendarEvents`: no change needed (uses `getEventEndDate` internally).
2. `src/server/routers/events.ts`:
   - Update `ConflictCheckInput` type: replace `durationMinutes` with `sets`.
   - Update `assertNoPerformerConflict`: Prisma select uses `sets`, candidate object uses `sets`.

**Files**: `src/entities/event/lib.ts`, `src/server/routers/events.ts`

---

### Phase 4 — tRPC Routers

**Goal**: Server enforces price locking, blocks missing rates, and handles sets throughout.

#### events.ts
1. `create` procedure:
   - Accept `sets` (from updated `CreateEventInputSchema`).
   - After validation, look up performer's `pricePerSet`:
     - If `musicianId`: `prisma.musician.findUnique({ where: { id }, select: { pricePerSet: true } })`.
     - If `bandId`: `prisma.band.findUnique({ where: { id }, select: { pricePerSet: true } })`.
   - If performer has no `pricePerSet` (null): throw `TRPCError({ code: "BAD_REQUEST", message: "El artista no tiene tarifa por set configurada." })`.
   - Calculate `price = pricePerSet × sets`, pass to Prisma create.
2. `update` procedure:
   - If `sets` changes: recalculate `price = currentPerformerRate × newSets` and update stored price.
   - If performer changes: recalculate `price = newPerformer.pricePerSet × event.sets`.
   - Audit log: track `SETS_CHANGE` action (analogous to existing `DURATION_CHANGE`).
3. Conflict check: pass `sets` to `assertNoPerformerConflict` (via Phase 3 update).

#### musicians.ts
- Replace `hourlyRate` with `pricePerSet` in create/update input handling and Prisma calls.
- Mirror to `User.pricePerSet` if the musician has a linked user account.

#### bands.ts
- Add `pricePerSet` to create and update procedures and Prisma calls.

#### reports.ts (new router)
Create `src/server/routers/reports.ts` with a single `summary` procedure:
- Input: `{ from: DateString, to: DateString }` (both YYYY-MM-DD).
- Query events in range with `price`, `sets`, `musicianId`, `musician`, `bandId`, `band`, `hotelId`, `hotel`, `date`.
- Return:
  ```ts
  {
    kpis: { totalEvents, totalSets, totalPayout, checkInRate },
    byMusician: { id, name, eventCount, totalSets, totalPayout }[],
    byHotel: { id, name, eventCount, totalSets, totalCharge }[],
    byMonth: { month: string, eventCount, totalSets, totalPayout }[],
  }
  ```
- Register in `src/server/routers/index.ts`.

**Files**: `src/server/routers/events.ts`, `src/server/routers/musicians.ts`, `src/server/routers/bands.ts`, `src/server/routers/reports.ts` (new), `src/server/routers/index.ts`

---

### Phase 5 — Event Form UI

**Goal**: Replace duration select with sets select; show locked auto-calculated cost.

Steps (`src/widgets/admin-events/ui.tsx`):
1. Replace duration select options (60/90/120/180 min) with sets select (1–12).
2. Default sets value: 2 (previously 120 min = 2 sets).
3. Add real-time cost preview: when performer + sets are both selected, display `Costo estimado: $X,XXX` (derived from performer's `pricePerSet` loaded with the performer list).
4. Remove any manual price input field — price is read-only / not shown as editable.
5. If selected performer has no `pricePerSet`, show inline warning: "Este artista no tiene tarifa por set. Configura la tarifa antes de crear el evento."
6. Form submit: remove `durationMinutes` references, pass `sets`.
7. Remove `String(event.durationMinutes)` / `Number(durationMinutes)` conversions; use `String(event.sets)` / `Number(sets)`.

**Files**: `src/widgets/admin-events/ui.tsx`

---

### Phase 6 — Musician & Band Management UI

**Goal**: Rename label in musician forms; add rate field to band forms.

Steps:
1. Musician create/edit form: rename label "Tarifa por hora" → "Tarifa por set" and field name `hourlyRate` → `pricePerSet`.
2. Band create/edit form: add `pricePerSet` input field (number, optional on edit, required on create for new enforcement — or optional with warning).
3. Musician list/detail: update column header and displayed value label.
4. Band list/detail: show `pricePerSet` column/field.

**Files**: `src/widgets/admin-musicians/ui.tsx` (or equivalent), `src/widgets/admin-bands/ui.tsx` (or equivalent) — exact paths TBD by file exploration during implementation.

---

### Phase 7 — Reports Page

**Goal**: Replace 100% mock data with real tRPC query; add date range picker; rename KPI.

Steps (`src/app/(authenticated)/reports/page.tsx`):
1. Add custom date range picker (start date + end date inputs, defaulting to current month).
2. Call `api.reports.summary.useQuery({ from, to })` with the selected range.
3. Replace all hardcoded `monthlyData`, `musicianPerformance`, `hotelDistribution` arrays with data returned from the query.
4. Rename KPI card "Horas Trabajadas" → "Sets Realizados"; display `totalSets` from query.
5. Rename KPI card "Pago Estimado" label as needed; display `totalPayout` from query.
6. Show loading skeleton while query is in flight.
7. Remove `generatePDFReport` and `generateWeeklyReport` alert stubs (out of scope; can leave UI buttons disabled).

**Files**: `src/app/(authenticated)/reports/page.tsx`

---

### Phase 8 — Specs & Tests

**Goal**: Ensure spec layer stays accurate; keep test suite green.

Steps:
1. `src/specs/features/events.scenarios.ts`:
   - Update "calendar end derived from durationMinutes" scenario → "calendar end derived from sets".
   - Add scenarios: "event cost is calculated from sets × pricePerSet", "event creation blocked when performer has no rate".
2. `src/__tests__/features/events.test.ts` and `src/__tests__/api/events.test.ts`:
   - Replace `durationMinutes` with `sets` in all test inputs/assertions.
   - Add tests for auto-price calculation and missing-rate blocking.
3. `src/__tests__/api/musicians.test.ts`: update `hourlyRate` → `pricePerSet`.
4. `src/__tests__/api/bands.test.ts`: add `pricePerSet` to create/update test cases.

**Files**: `src/specs/features/events.scenarios.ts`, `src/__tests__/features/events.test.ts`, `src/__tests__/api/events.test.ts`, `src/__tests__/api/musicians.test.ts`, `src/__tests__/api/bands.test.ts`

---

## Technical Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Prisma | Already in use | New migration required |
| tRPC | Already in use | New `reports` router |
| Zod | Already in use | Schema updates only |
| date-fns `addMinutes` | Already in use | No change needed |
| Recharts | Already in use | No change needed |
| shadcn DatePicker | Check | Need a date range picker component — verify if already installed |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `durationMinutes` referenced in 8+ files | Phase ordering: schema → lib → router → UI → tests. Never leave a half-migrated state. |
| `eventsOverlap` used on both client and server | Both updated in Phase 3 atomically before any consumer is changed. |
| 90-min events → 2 sets changes event length | `CEIL` rounds up; a 90-min event becomes 120 min. Acceptable per spec decision. |
| Band has existing data, new `pricePerSet` nullable | Column is nullable — existing bands get null. UI must surface this as a warning when booking. |
| Reports query performance | Filter by `organizationId` + date range; both indexed. Acceptable for current data volume. |
| Pre-existing build error in `seed.ts` (location fields) | Fix in Phase 1 Step 3 alongside sets migration. |

---

## Out of Scope

- Invoice/PDF generation
- Payment tracking (marking musicians as paid)
- Hotel-facing portal or hotel billing accounts
- Org margin/markup
- Multi-currency
- CSV/Excel export
- Aggregating band cost from member musician rates
