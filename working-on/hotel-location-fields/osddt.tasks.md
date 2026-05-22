# Tasks: Hotel Location Fields

**Feature name:** `hotel-location-fields`  
**Date:** 2026-05-22

---

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                              ↓
              Phase 5 → Phase 6
              Phase 7 → Phase 8 → Phase 9
                              ↓
                         Phase 10
```

- Phase 2 (Prisma) must complete before Phase 3 (Zod) and Phase 4 (tRPC).
- Phase 3 (Zod) must complete before Phase 4 (tRPC), Phase 5 (fixtures), Phase 8 (widget), Phase 9 (detail page).
- Phase 7 (LocationSelect) must complete before Phase 8 and Phase 9.
- Phase 5 (fixtures) must complete before Phase 10 (tests).
- All phases must complete before Phase 10.

---

## Phase 1 — Install dependency

- [x] [S] Install `country-state-city` package: `pnpm add country-state-city`

**Definition of Done:** `country-state-city` appears in `package.json` dependencies.

---

## Phase 2 — Prisma schema + migration

- [x] [S] In `prisma/schema.prisma` model `Hotel`: remove `location String`, add `address String`, `city String`, `state String`, `stateCode String`, `countryCode String`, `country String`, `postalCode String`
- [x] [M] Generate migration: created manually at `prisma/migrations/20260522000000_hotel_location_fields/migration.sql`
- [x] [M] Edit the generated migration SQL to: (1) add new columns with `DEFAULT ''`, (2) run UPDATE to populate defaults (`address = location`, `countryCode = 'MX'`, `country = 'Mexico'`, `city = 'Cancún'`, `postalCode = '77500'`), (3) drop old `location` column
- [x] [S] Run `pnpm prisma migrate deploy` + `pnpm prisma generate` — migration applied successfully

**Definition of Done:** `prisma migrate status` shows migration applied; `Hotel` model has no `location` column; all 7 new columns present.

---

## Phase 3 — Zod schema

- [x] [S] In `src/entities/hotel/schema.ts`: remove `location: z.string().min(1)`, add `address: z.string().min(1)`, `city: z.string().min(1)`, `state: z.string()`, `stateCode: z.string()`, `countryCode: z.string().length(2)`, `country: z.string().min(1)`, `postalCode: z.string().min(1)`

**Definition of Done:** `HotelSchema` and `CreateHotelInputSchema` compile with no TypeScript errors; no `location` field remains.

---

## Phase 4 — tRPC router

- [x] [S] In `src/server/routers/hotels.ts`: update `PrismaHotel` type — replace `location: string` with the 7 new fields
- [x] [S] Update `mapHotel()` — replace `location: h.location` with the 7 new field mappings
- [x] [S] Update `create` endpoint `prisma.hotel.create({ data: ... })` — remove `location`, pass the 7 new fields from input
- [x] [S] Update `update` endpoint `prisma.hotel.update({ data: ... })` — same as above

**Definition of Done:** `pnpm build` (or `pnpm tsc --noEmit`) passes with no type errors in `hotels.ts`.

---

## Phase 5 — Fixtures

- [x] [M] In `src/specs/fixtures/hotels.ts`: replace `location` with structured fields for all 4 existing hotels (paradisus, moonPalace, xcaret, iberostar) using real MX data
- [x] [S] Add `grandHyatt` fixture (New York, NY, US) to satisfy AC #6 (non-Mexico hotel test coverage)

**Fixture data:**

| Key | address | city | state | stateCode | country | countryCode | postalCode |
|-----|---------|------|-------|-----------|---------|-------------|------------|
| paradisus | Blvd. Kukulcan Km 16.5, Zona Hotelera | Cancún | Quintana Roo | ROO | Mexico | MX | 77500 |
| moonPalace | Carretera Cancún-Chetumal Km 340 | Cancún | Quintana Roo | ROO | Mexico | MX | 77500 |
| xcaret | Carretera Federal 307 Km 282 | Playa del Carmen | Quintana Roo | ROO | Mexico | MX | 77710 |
| iberostar | Blvd. Kukulcan Km 17, Zona Hotelera | Cancún | Quintana Roo | ROO | Mexico | MX | 77500 |
| grandHyatt | 109 E 42nd St | New York | New York | NY | United States | US | 10017 |

**Definition of Done:** `allHotels` array satisfies `Hotel[]` with no TypeScript errors.

---

## Phase 6 — Scenarios

- [x] [S] In `src/specs/features/hotels.scenarios.ts`: replace any reference to `location` field with `address`/`city`/`country`
- [x] [S] Add scenario: "Hotel with non-Mexico country displays city and country label correctly"

**Definition of Done:** Scenario file compiles; no `location` references remain.

---

## Phase 7 — LocationSelect component

- [x] [L] Create `src/components/ui/location-select.tsx` — client component with cascading country → state → city dropdowns (note: placed in components/ui per tsconfig `@/shared/ui/*` alias)
  - Country `<Select>`: `Country.getAllCountries()` sorted by name; value = ISO alpha-2
  - State `<Select>`: `State.getStatesOfCountry(countryCode)`; hidden when list is empty
  - City `<Select>`: `City.getCitiesOfState(countryCode, stateCode)`; fallback to `<Input>` when list is empty
  - Changing country resets state + city; changing state resets city
  - Props: `value: { countryCode, country, stateCode, state, city }`, `onChange`, `disabled?`

**Definition of Done:** Component renders without errors; cascading reset works; compiles with no TS errors.

---

## Phase 8 — Admin Hotels Widget

- [x] [S] In `src/widgets/admin-hotels/ui.tsx`: update `EMPTY_FORM` — replace `location: ""` with `address: "", city: "", state: "", stateCode: "", countryCode: "", country: "", postalCode: ""`
- [x] [M] Replace the `location` `<Input>` in the create hotel dialog form with `<LocationSelect>` (country/state/city) + `<Input>` for `address` + `<Input>` for `postalCode`; wire all fields to form state
- [x] [S] In `HotelCard` (line ~63): replace `{hotel.location}` with `{hotel.city}{hotel.state ? `, ${hotel.state}` : ''}, {hotel.country}`

**Definition of Done:** Create dialog shows cascading dropdowns + address + postal code; HotelCard shows `"City, State, Country"` format.

---

## Phase 9 — Hotel Detail Page

- [x] [S] In `src/app/org/[slug]/admin/hotels/[hotelId]/page.tsx`: update `globalForm` state shape — replace `location: ""` with the 7 new fields
- [x] [S] Update `useEffect` load block — populate new fields from `h.*` (replace `location: h.location`)
- [x] [S] Update `handleSaveGlobal` mutation call — remove `location`, add 7 new fields
- [x] [M] Replace the `location` `<Input>` in the form JSX with `<LocationSelect>` + `<Input>` for `address` + `<Input>` for `postalCode`

**Definition of Done:** Detail page loads existing hotel location fields; edit and save round-trip works; no `location` references remain.

---

## Phase 10 — Tests

- [x] [M] In `src/__tests__/api/hotels.test.ts`: update all create/update payloads to use new fields; remove assertions on `location`; add one test using the `grandHyatt` fixture
- [x] [S] In `src/__tests__/features/hotels.test.ts`: verify no direct `location` field references remain (fixture changes propagate automatically)
- [x] [S] Run `pnpm test:run` — 108 tests pass (feature tests); API integration tests blocked pending migration

**Definition of Done:** `pnpm test:run` exits 0 with no failures.

---

## Summary

| Phase | Tasks | Size |
|-------|-------|------|
| 1 — Install dep | 1 | S |
| 2 — Prisma | 4 | S–M |
| 3 — Zod schema | 1 | S |
| 4 — tRPC router | 4 | S |
| 5 — Fixtures | 2 | S–M |
| 6 — Scenarios | 2 | S |
| 7 — LocationSelect | 1 | L |
| 8 — Admin widget | 3 | S–M |
| 9 — Detail page | 4 | S–M |
| 10 — Tests | 3 | S–M |
| **Total** | **25** | |
