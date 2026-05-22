# Tasks: Event Sets, Pricing & Reports

**Feature name**: `event-sets-pricing-reports`
**Date**: 2026-05-22

---

## Dependencies

```
Phase 1 (Prisma) → Phase 2 (Zod/Fixtures) → Phase 3 (lib.ts) → Phase 4 (routers)
Phase 4 → Phase 5 (event form UI)
Phase 2 → Phase 6 (musician/band UI)
Phase 4 → Phase 7 (reports page)
Phase 2 + Phase 4 → Phase 8 (specs/tests)
```

---

## Phase 1 — Prisma Schema & Migration

- [x] [S] Add `sets Int` column to `Event` model in `prisma/schema.prisma`, remove `durationMinutes Int`
- [x] [S] Rename `hourlyRate Float` → `pricePerSet Float` on `Musician` model in `prisma/schema.prisma`
- [x] [S] Rename `hourlyRate Float?` → `pricePerSet Float?` on `User` model in `prisma/schema.prisma`
- [x] [S] Add `pricePerSet Float?` to `Band` model in `prisma/schema.prisma`
- [x] [M] Write migration SQL: compute `sets = CEIL(durationMinutes / 60.0)`, rename `hourlyRate` columns, add `Band.pricePerSet`
- [x] [M] Fix `prisma/seed.ts`: replace `location` with structured address fields, replace `hourlyRate` with `pricePerSet`, replace `durationMinutes` with `sets`

**Definition of Done**: `pnpm build` passes prisma generate step; migration SQL is valid; seed compiles without type errors.

---

## Phase 2 — Zod Schemas & Fixtures

- [x] [S] `src/entities/event/schema.ts`: replace `DurationMinutes` validator with `Sets` (`z.number().int().min(1).max(12)`); rename field `durationMinutes` → `sets`; remove `price` from `CreateEventInputSchema`
- [x] [S] `src/entities/musician/schema.ts`: rename `hourlyRate` → `pricePerSet`
- [x] [S] `src/entities/band/schema.ts`: add `pricePerSet: z.number().positive().optional()` to `BandSchema` and `CreateBandInputSchema`
- [x] [S] `src/specs/fixtures/events.ts`: replace all `durationMinutes` values with `sets` (60 min → 1, 90 min → 2, 120 min → 2, 180 min → 3)
- [x] [S] `src/specs/fixtures/musicians.ts`: rename `hourlyRate` → `pricePerSet`
- [x] [S] Find and update any band fixtures — add `pricePerSet` values

**Definition of Done**: TypeScript compiles; `pnpm test:run` passes all existing schema/fixture-level tests.

---

## Phase 3 — Domain Logic (event lib)

- [x] [S] `src/entities/event/lib.ts` — `getEventEndDate`: update Pick type to `sets`, compute `addMinutes(start, event.sets * 60)`
- [x] [S] `src/entities/event/lib.ts` — `getEventTimeLabel`: update Pick type to `sets`
- [x] [S] `src/entities/event/lib.ts` — `eventsOverlap`: update Pick type to `sets`
- [x] [S] `src/entities/event/lib.ts` — `getCalendarSummary`: replace `durationMinutes / 60` accumulator with `sets`; rename result key `estimatedHours` → `totalSets`
- [x] [S] `src/server/routers/events.ts` — `ConflictCheckInput` type: replace `durationMinutes` with `sets`
- [x] [S] `src/server/routers/events.ts` — `assertNoPerformerConflict`: update Prisma select and candidate object to use `sets`

**Definition of Done**: TypeScript compiles; overlap/calendar logic still correct (verify via `pnpm test:run`).

---

## Phase 4 — tRPC Routers

- [x] [M] `src/server/routers/events.ts` — `create` procedure: look up performer `pricePerSet`; throw `BAD_REQUEST` if null; calculate and store `price = pricePerSet × sets`
- [x] [M] `src/server/routers/events.ts` — `update` procedure: recalculate `price` when `sets` or performer changes; add `SETS_CHANGE` audit log action
- [x] [S] `src/server/routers/musicians.ts`: replace `hourlyRate` with `pricePerSet` in create/update; mirror to `User.pricePerSet` for linked user accounts
- [x] [S] `src/server/routers/bands.ts`: add `pricePerSet` to create and update procedures and Prisma calls
- [x] [L] Create `src/server/routers/reports.ts`: `summary` procedure accepting `{ from, to }` date strings; return `kpis`, `byMusician`, `byHotel`, `byMonth` aggregations
- [x] [S] `src/server/routers/index.ts`: register `reports` router

**Definition of Done**: `pnpm build` passes; API integration tests pass; calling create with a performer with no rate throws the expected error.

---

## Phase 5 — Event Form UI

- [x] [S] `src/widgets/admin-events/ui.tsx`: replace duration select (60/90/120/180 min) with sets select (1–12); update default to `2`
- [x] [S] `src/widgets/admin-events/ui.tsx`: remove `String(event.durationMinutes)` / `Number(durationMinutes)` conversions; use `sets`
- [x] [M] `src/widgets/admin-events/ui.tsx`: add real-time cost preview — compute `performer.pricePerSet × sets` and display as "Costo estimado: $X,XXX" when both performer and sets are selected
- [x] [S] `src/widgets/admin-events/ui.tsx`: show inline warning if selected performer has no `pricePerSet`; disable save button
- [x] [S] `src/widgets/admin-events/ui.tsx`: remove any editable price input; show stored `event.price` as read-only display on the edit form

**Definition of Done**: Can create and edit events using sets; cost preview updates live; form blocks submission when performer has no rate.

---

## Phase 6 — Musician & Band Management UI

- [x] [S] Find musician create/edit form widget; rename label "Tarifa por hora" → "Tarifa por set" and field `hourlyRate` → `pricePerSet`
- [x] [S] Find musician list/detail view; update column header and display label
- [x] [M] Find band create/edit form widget; add `pricePerSet` number input field
- [x] [S] Find band list/detail view; add `pricePerSet` column/display

**Definition of Done**: Musician and band forms save `pricePerSet` correctly; labels read "por set" throughout.

---

## Phase 7 — Reports Page

- [x] [M] `src/app/(authenticated)/reports/page.tsx`: add custom date range picker (start + end date inputs, default to current month start→today)
- [x] [M] `src/app/(authenticated)/reports/page.tsx`: replace all hardcoded mock arrays (`monthlyData`, `musicianPerformance`, `hotelDistribution`) with `api.reports.summary.useQuery({ from, to })` data
- [x] [S] `src/app/(authenticated)/reports/page.tsx`: rename KPI "Horas Trabajadas" → "Sets Realizados"; bind to `kpis.totalSets`
- [x] [S] `src/app/(authenticated)/reports/page.tsx`: bind "Pago Estimado" KPI to `kpis.totalPayout`; bind "Total Eventos" to `kpis.totalEvents`; bind "Check-in Rate" to `kpis.checkInRate`
- [x] [S] `src/app/(authenticated)/reports/page.tsx`: add loading skeleton while query is in flight
- [x] [S] `src/app/(authenticated)/reports/page.tsx`: disable (not remove) PDF and weekly report buttons — leave as UI stubs

**Definition of Done**: Reports page shows real figures matching actual DB data for the selected date range; no hardcoded values remain.

---

## Phase 8 — Specs & Tests

- [x] [S] `src/specs/features/events.scenarios.ts`: update "calendar end derived from durationMinutes" scenario to use `sets`
- [x] [S] `src/specs/features/events.scenarios.ts`: add scenario "event cost is calculated as sets × pricePerSet"
- [x] [S] `src/specs/features/events.scenarios.ts`: add scenario "event creation is blocked when performer has no pricePerSet"
- [x] [M] `src/__tests__/features/events.test.ts`: replace `durationMinutes` with `sets` throughout; add tests for auto-price and missing-rate blocking
- [x] [M] `src/__tests__/api/events.test.ts`: replace `durationMinutes` with `sets`; add integration tests for price calculation and rate-missing error
- [x] [S] `src/__tests__/api/musicians.test.ts`: replace `hourlyRate` → `pricePerSet`
- [x] [S] `src/__tests__/api/bands.test.ts`: add `pricePerSet` to create/update test cases

**Definition of Done**: `pnpm test:run` passes with zero failures; all new scenarios have corresponding passing tests.
