# Plan: Hotel Location Fields

**Feature name:** `hotel-location-fields`  
**Date:** 2026-05-22  
**Stack:** Next.js 16, Prisma 7, tRPC 11, Zod 4, Effector, shadcn/ui, `country-state-city`

---

## Architecture Overview

- **Data layer**: Replace `location String` with 6 scalar columns on `Hotel`. Scalar columns (not JSON) keep fields individually indexable and queryable.
- **Schema layer**: Zod schema is the single source of truth; Prisma types inferred from DB; tRPC validates with Zod. No manual `type` declarations.
- **UI layer**: `country-state-city` imported only in client components. Cascading dropdowns: country → state (if country has states) → city (from state). Street address and postal code are plain text inputs.
- **Migration strategy**: Single migration drops `location`, adds 6 new columns with defaults for existing rows (`countryCode='MX'`, `country='Mexico'`, old `location` value → `address`). Development reset acceptable.

### New Hotel fields

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `address` | `String` | yes | Replaces old `location`; free-text street address |
| `city` | `String` | yes | City name |
| `state` | `String` | no | State/province name; empty string for countries with none |
| `stateCode` | `String` | no | ISO 3166-2 state code; empty string when no state |
| `countryCode` | `String` | yes | ISO 3166-1 alpha-2 (e.g. `MX`, `US`) |
| `country` | `String` | yes | Country display name |
| `postalCode` | `String` | yes | Required per decision #2 |

---

## Implementation Phases

### Phase 1 — Install dependency

- Install `country-state-city` as a production dependency.

**Files:** `package.json`

---

### Phase 2 — Prisma schema + migration

- In `prisma/schema.prisma`, inside `model Hotel`:
  - Remove `location String`
  - Add 7 new scalar fields: `address`, `city`, `state`, `stateCode`, `countryCode`, `country`, `postalCode`
- Generate and run the migration. Because we are in development, a reset + re-migrate is acceptable.
- The migration SQL must:
  1. Add all new columns as `TEXT NOT NULL DEFAULT ''` (temporary empty defaults to avoid null violations during migration)
  2. Run an `UPDATE Hotel SET address = location, countryCode = 'MX', country = 'Mexico', city = 'Cancún', postalCode = '77500'` (reasonable defaults for the 4 existing Mexico hotels; exact city/postal per fixture)
  3. Drop the `location` column

**Files:**
- `prisma/schema.prisma` (lines 226-242)
- `prisma/migrations/<timestamp>_hotel_location_fields/migration.sql` (generated)

---

### Phase 3 — Zod schema

Update `src/entities/hotel/schema.ts`:

- Remove `location: z.string().min(1)`
- Add:
  ```typescript
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string(),           // optional — empty string when country has no states
  stateCode: z.string(),
  countryCode: z.string().min(2).max(2),  // ISO 3166-1 alpha-2
  country: z.string().min(1),
  postalCode: z.string().min(1),
  ```
- `CreateHotelInputSchema` picks up changes automatically via `HotelSchema.omit(...)`.

**Files:** `src/entities/hotel/schema.ts`

---

### Phase 4 — tRPC router

Update `src/server/routers/hotels.ts`:

1. **`PrismaHotel` type** (lines 8-18): replace `location: string` with the 7 new fields.
2. **`mapHotel()`** (lines 26-38): replace `location: h.location` with the 7 new fields mapped 1:1.
3. **`create` endpoint**: input schema already derives from `CreateHotelInputSchema` — Zod picks up new fields automatically. Update the `prisma.hotel.create({ data: ... })` call to pass new fields and remove `location`.
4. **`update` endpoint**: same — remove `location` from input and Prisma call, add new fields.

**Files:** `src/server/routers/hotels.ts`

---

### Phase 5 — Fixtures

Update `src/specs/fixtures/hotels.ts` with real structured data for the 4 existing Mexico hotels:

| Fixture | city | state | stateCode | country | countryCode | postalCode | address |
|---------|------|-------|-----------|---------|-------------|------------|---------|
| paradisus | Cancún | Quintana Roo | ROO | Mexico | MX | 77500 | Blvd. Kukulcan Km 16.5, Zona Hotelera |
| moonPalace | Cancún | Quintana Roo | ROO | Mexico | MX | 77500 | Carretera Cancún-Chetumal Km 340 |
| xcaret | Playa del Carmen | Quintana Roo | ROO | Mexico | MX | 77710 | Carretera Federal 307 Km 282 |
| iberostar | Cancún | Quintana Roo | ROO | Mexico | MX | 77500 | Blvd. Kukulcan Km 17, Zona Hotelera |

Add one additional fixture for a non-Mexico hotel (for test coverage of AC #6):

| Fixture | city | state | stateCode | country | countryCode | postalCode | address |
|---------|------|-------|-----------|---------|-------------|------------|---------|
| grandHyatt | New York | New York | NY | United States | US | 10017 | 109 E 42nd St |

**Files:** `src/specs/fixtures/hotels.ts`

---

### Phase 6 — Scenarios

Update `src/specs/features/hotels.scenarios.ts`:

- Replace any scenario that references `location` with `address`/`city`/`country`.
- Add scenario: "Hotel with non-Mexico country displays correct city and country label."

**Files:** `src/specs/features/hotels.scenarios.ts`

---

### Phase 7 — LocationSelect component

Create `src/shared/ui/location-select.tsx` — a client component that encapsulates the cascading country → state → city dropdowns using `country-state-city`.

**Contract:**
```typescript
interface LocationSelectProps {
  value: {
    countryCode: string
    country: string
    stateCode: string
    state: string
    city: string
  }
  onChange: (value: LocationSelectProps['value']) => void
  disabled?: boolean
}
```

**Behavior:**
- Country dropdown: all countries from `Country.getAllCountries()`, sorted alphabetically, value = ISO alpha-2 code.
- State dropdown: `State.getStatesOfCountry(countryCode)`. If empty array → hide the dropdown, set `state: ''` and `stateCode: ''`.
- City dropdown: `City.getCitiesOfState(countryCode, stateCode)`. If empty array → free-text input fallback.
- Changing country resets state and city.
- Changing state resets city.

Uses `@radix-ui/react-select` (already installed via shadcn/ui).

**Files:** `src/shared/ui/location-select.tsx`

---

### Phase 8 — Admin Hotels Widget (create form + HotelCard)

Update `src/widgets/admin-hotels/ui.tsx`:

1. **`EMPTY_FORM`** (line 31): replace `location: ""` with `address: "", city: "", state: "", stateCode: "", countryCode: "", country: "", postalCode: ""`.

2. **Create hotel dialog form**: replace the `location` `<Input>` with:
   - `<LocationSelect>` for country/state/city (wired to form state)
   - `<Input>` for `address` (street address label)
   - `<Input>` for `postalCode`

3. **`HotelCard`** (line 63): replace `{hotel.location}` with:
   ```tsx
   {hotel.city}{hotel.state ? `, ${hotel.state}` : ''}, {hotel.country}
   ```

**Files:** `src/widgets/admin-hotels/ui.tsx`

---

### Phase 9 — Hotel Detail Page

Update `src/app/org/[slug]/admin/hotels/[hotelId]/page.tsx`:

1. **`globalForm` state** (line 29): replace `location: ""` with the 7 new fields.
2. **`useEffect` load** (lines 43-49): populate new fields from `h.*`.
3. **`handleSaveGlobal`** (lines 68-76): remove `location`, add new fields to mutation input.
4. **Form JSX**: replace the single `location` `<Input>` with:
   - `<LocationSelect>` for country/state/city
   - `<Input>` for `address`
   - `<Input>` for `postalCode`

**Files:** `src/app/org/[slug]/admin/hotels/[hotelId]/page.tsx`

---

### Phase 10 — Tests

1. **`src/__tests__/api/hotels.test.ts`**: update all `create`/`update` payloads to use new fields. Remove any assertion on `location`.

2. **`src/__tests__/features/hotels.test.ts`**: fixture references auto-update when `hotels.ts` fixtures are updated. Verify no direct `location` references remain.

3. Add one test case using the `grandHyatt` fixture (non-Mexico) to satisfy AC #6.

**Files:**
- `src/__tests__/api/hotels.test.ts`
- `src/__tests__/features/hotels.test.ts`

---

## Technical Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `country-state-city` | latest | Country/state/city data for dropdowns |
| `@radix-ui/react-select` | already installed | Dropdown UI (via shadcn/ui) |
| `zod` | `^4.3.6` | already installed | Schema validation |
| `prisma` | `^7.8.0` | already installed | DB migration + ORM |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Migration drops `location` — no rollback | Acceptable in development; team confirmed reset is fine |
| `country-state-city` city list may be empty for some states | Fallback to free-text `<Input>` when `getCitiesOfState()` returns `[]` |
| `country-state-city` bundle is ~6MB unpacked | Import only inside client components; never in server/shared layer |
| tRPC `update` input schema is derived from `HotelSchema` — adding fields extends the input automatically, but any hard-coded pick/partial calls must be audited | Audit all `.pick()` / `.partial()` calls in the router after Zod schema change |

---

## Out of Scope

- Filtering/searching hotels by country or city in the admin UI
- Org-specific location overrides on `HotelOrganization`
- GPS coordinates for hotels
- Address autocomplete (Google Places or similar)
- Phone number formatting by country
