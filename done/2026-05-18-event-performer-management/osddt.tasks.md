# Tasks: Event Performer Management

**Feature**: `event-performer-management`  
**Date**: 2026-05-18

---

## Dependencies

```
Phase 1 (Schemas) → Phase 2 (Prisma) → Phase 3 (Fixtures/Scenarios)
                                      → Phase 4 (Backend)
                                      → Phase 5 (Conflict Lib)
Phase 3 + Phase 4 + Phase 5 → Phase 6 (Feature Models)
Phase 6 → Phase 7 (UI)
Phase 3 + Phase 4 → Phase 8 (Tests)
```

---

## Phase 1 — Zod Schemas

> **DoD**: All types compile. `shared/types/index.ts` exports `Band`, `BandMember`, `CreateBandInput`. Musician type has `instruments`/`styles`, not `shows`. Event type has `band` and `bandId`.

- [x] [S] Create `entities/band/schema.ts` with `BandSchema`, `BandMemberSchema`, `CreateBandInputSchema`, and exported types
- [x] [S] Update `entities/musician/schema.ts`: replace `shows` with `instruments: z.array(z.string()).min(1)` and `styles: z.array(z.string()).min(1)`; update `CreateMusicianInputSchema`
- [x] [S] Update `entities/event/schema.ts`: add `band: z.string().optional()` and `bandId: z.string().optional()`; update `CreateEventInputSchema`
- [x] [S] Update `specs/entities/index.ts`: re-export Band types
- [x] [S] Update `shared/types/index.ts`: re-export `Band`, `BandMember`, `CreateBandInput`

---

## Phase 2 — Prisma Schema + Migration

> **DoD**: `prisma migrate dev` succeeds. DB has `Band`, `BandMember`, `BandOrganization` tables. `Musician` has `instruments`/`styles` columns. `Event` has `band`/`bandId` columns. Seed runs without errors.

- [x] [M] Add `Band`, `BandMember`, `BandOrganization` models to `prisma/schema.prisma`
- [x] [M] Update `Musician` model: rename `shows` → `instruments`, add `styles String[] @default([])`, add `bands BandMember[]` relation
- [x] [S] Update `Event` model: add `band String?`, `bandId String?`, `bandRel Band? @relation(...)`
- [x] [S] Update `Organization` model: add `bands BandOrganization[]` reverse relation
- [x] [S] Update `User` model: rename `shows` → `instruments`, add `styles String[] @default([])`
- [x] [S] Write data migration in the migration SQL: copy existing `shows` values into `instruments` for both `Musician` and `User` tables
- [x] [S] Run `prisma migrate dev --name add-band-performer-model`
- [x] [S] Update `prisma/seed.ts`: add sample bands (≥2 bands, each with ≥2 musician members)

---

## Phase 3 — Fixtures + Scenarios

> **DoD**: Fixtures compile and export `allBands`. Scenarios cover all band booking and conflict cases. Musician fixtures use `instruments`/`styles`.

- [x] [S] Update `specs/fixtures/musicians.ts`: rename `shows` → `instruments`, add `styles` array per musician
- [x] [S] Create `specs/fixtures/bands.ts`: define `jazzTrio`, `flamencoGroup`, `allBands`; include `members` arrays linking to fixture musician IDs
- [x] [S] Update `specs/fixtures/index.ts`: export `allBands`, `jazzTrio`, `flamencoGroup`
- [x] [M] Update `specs/features/events.scenarios.ts`: add scenarios for band booking (happy path), solo-vs-band conflict, band-vs-solo conflict, band-vs-band conflict, non-overlapping allowed
- [x] [S] Update `specs/features/musicians.scenarios.ts`: replace `shows` references with `instruments`/`styles`

---

## Phase 4 — Backend: tRPC Routers

> **DoD**: All tRPC procedures callable. Band CRUD works. Event create/update accepts `bandId`, validates org membership, runs full conflict detection. Musician event view includes band events.

- [x] [L] Create `server/routers/bands.ts` with procedures: `getAll`, `getById`, `create` (validates ≥2 members + org link), `update`, `addMember`, `removeMember` (validates ≥2 members remain in DB transaction), `deactivate`
- [x] [S] Update `server/routers/index.ts`: register `bandsRouter`
- [x] [M] Update `server/routers/events.ts` — `mapEvent`: add `band` and `bandId` fields to mapped output
- [x] [M] Update `server/routers/events.ts` — `create`: add `bandId` input (mutually exclusive with `musicianId`), validate against `BandOrganization`, run server-side conflict detection for both solo and band cases
- [x] [M] Update `server/routers/events.ts` — `update`: same bandId handling and conflict detection as create
- [x] [M] Update `server/routers/events.ts` — `getAll` musician view: expand query to include events where musician is member of booked band (`bandId IN musician's bands`)
- [x] [S] Update `server/routers/musicians.ts`: map `shows` → `instruments` + `styles` in all create/update/map functions

---

## Phase 5 — Conflict Detection Lib

> **DoD**: `getSchedulingConflicts` correctly handles solo-vs-solo, solo-vs-band, band-vs-solo, band-vs-band cases. `hasSchedulingConflict` updated accordingly.

- [x] [M] Update `entities/event/lib.ts` — `getSchedulingConflicts`: add optional `bandMemberIds: Record<string, string[]>` parameter; implement all four conflict cases (solo/solo, solo/band, band/solo, band/band)
- [x] [S] Update `hasSchedulingConflict` call signature to forward `bandMemberIds`

---

## Phase 6 — Feature Models (Effector)

> **DoD**: `$bands` store loads org bands. Band CRUD effects callable from UI. Events model handles `band`/`bandId`. Musicians model uses `instruments`/`styles`.

- [x] [S] Create `shared/api/bands.ts`: tRPC client wrappers for all band procedures (mirrors `shared/api/musicians.ts` pattern)
- [x] [M] Create `features/bands/model.ts`: `$bands` store, `loadBandsFx`, `createBandFx`, `updateBandFx`, `addMemberFx`, `removeMemberFx`, `deactivateBandFx`; wire to `shared/api/bands.ts`
- [x] [S] Update `features/events/model.ts`: Event type now includes `band?`/`bandId?` (propagated via type inference, no explicit changes needed)
- [x] [S] Update `features/musicians/model.ts`: no `shows` references in model — type changes propagate automatically

---

## Phase 7 — UI

> **DoD**: Admin can create/manage bands. Event form has working Solo/Band toggle. All event displays show correct performer name. "Bandas" nav link present.

- [x] [L] Create `widgets/admin-bands/ui.tsx`: band list with member count/genre/status; create band form (name, description, genre, multi-select member picker); inline member add/remove; deactivate action
- [x] [M] Create `app/org/[slug]/admin/bands/page.tsx`: page wrapping `admin-bands` widget
- [x] [M] Update `widgets/admin-events/ui.tsx`: replace single musician `<Select>` with Solo/Band radio toggle; show musician picker when Solo selected; show band picker (active only) when Band selected; selecting one clears the other
- [x] [S] Update `widgets/admin-musicians/ui.tsx`: replace `shows` input with `instruments` tags input and `styles` tags input
- [x] [S] Update `widgets/event-list/ui.tsx`: display `event.musician ?? event.band ?? "—"` as performer name
- [x] [S] Update `widgets/calendar/ui.tsx`: show performer name correctly for band events
- [x] [S] Update `widgets/navigation/ui.tsx`: add "Bandas" link to org admin nav section

---

## Phase 8 — Tests

> **DoD**: `pnpm test:run` passes. All new band scenarios covered. Musician tests use updated field names.

- [x] [M] Update `__tests__/features/events.test.ts`: add tests for band booking happy path, solo-vs-band conflict (blocked), band-vs-solo conflict (blocked), band-vs-band shared member conflict (blocked), non-overlapping solo+band (allowed)
- [x] [M] Create `__tests__/features/bands.test.ts`: create band ≥2 members, reject <2 members, add member, remove member (success + reject if would drop below 2), deactivate
- [x] [S] Update `__tests__/features/musicians.test.ts`: replace `shows` with `instruments`/`styles` throughout

---

## Summary

| Phase | Tasks | Complexity |
|-------|-------|------------|
| 1 — Zod Schemas | 5 | S×5 |
| 2 — Prisma | 8 | S×6, M×2 |
| 3 — Fixtures + Scenarios | 5 | S×4, M×1 |
| 4 — Backend tRPC | 7 | S×2, M×4, L×1 |
| 5 — Conflict Lib | 2 | S×1, M×1 |
| 6 — Feature Models | 4 | S×3, M×1 |
| 7 — UI | 7 | S×5, M×1, L×1 |
| 8 — Tests | 3 | S×1, M×2 |
| **Total** | **41** | |
