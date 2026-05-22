# Research: Hotel Location Fields

**Feature name:** `hotel-location-fields`  
**Branch:** `icaamal/feat-better-roles`  
**Date:** 2026-05-22

---

## Topic

Expand the `Hotel` entity to store structured location data — country, state/province, city, and street address — replacing the current single `location: String` field. An org can have hotels in different countries, so location must support ISO country codes, state lookup per country, and city.

---

## Codebase Findings

### Current Hotel schema

**Prisma** (`prisma/schema.prisma` lines 226-242):
```prisma
model Hotel {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  phone         String
  location      String          // ← single unstructured string
  contactPerson String
  isActive      Boolean  @default(true)
  avatar        String?
  createdAt     DateTime @default(now())

  events        Event[]
  users         User[]
  organizations HotelOrganization[]
}
```

**Zod** (`src/entities/hotel/schema.ts` lines 1-19):
```typescript
export const HotelSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  location: z.string().min(1),   // ← same single field
  contactPerson: z.string().min(1),
  isActive: z.boolean().default(true),
  avatar: z.string().optional(),
  createdAt: z.string().datetime(),
});
```

**Fixtures** (`src/specs/fixtures/hotels.ts`):
```typescript
location: "Blvd. Kukulcan Km 16.5, Zona Hotelera, Cancún"
location: "Carretera Federal 307 Km 282, Playa del Carmen"
```

### Organization–Hotel relation

- Many-to-many via `HotelOrganization` join table (`prisma/schema.prisma` lines 121-133)
- Org-specific overrides live on the join (`contactPerson`, `contactPhone`)
- Global hotel fields (including `location`) are shared across all orgs that link to the same hotel

### Affected files (full list)

| File | What changes |
|------|-------------|
| `prisma/schema.prisma` | Replace `location String` with structured fields |
| `src/entities/hotel/schema.ts` | Update Zod schema |
| `src/shared/types/index.ts` | Re-exports — no manual edits needed (re-infers from schema) |
| `src/specs/fixtures/hotels.ts` | Update fixture data with real country/state/city values |
| `src/specs/features/hotels.scenarios.ts` | Add/update scenario for structured location |
| `src/server/routers/hotels.ts` | Update `mapHotel()`, `create`, `update` endpoints |
| `src/features/hotels/model.ts` | Effects pass new fields; no store shape change needed |
| `src/widgets/admin-hotels/ui.tsx` | HotelCard: display city+country; create form: add location fields |
| `src/app/org/[slug]/admin/hotels/[hotelId]/page.tsx` | Detail view: show/edit new fields |
| `src/__tests__/api/hotels.test.ts` | Update test payloads |
| `src/__tests__/features/hotels.test.ts` | Update fixture references |

### Precedent: Event has structured geo

`Event.checkInLocation: Json?` stores `{ lat, lng }` — so the codebase already handles JSON/structured geo in Prisma. Hotel location is different (descriptive address, not GPS).

### No existing country/address packages

Current `package.json` has **no** country, address, or phone-country packages.

---

## External References

### Recommended package: `country-state-city`

- npm: [`country-state-city`](https://www.npmjs.com/package/country-state-city)
- TypeScript-first, ISO 3166-1/3166-2 compliant
- Provides `Country`, `State`, `City` classes with `.getAllCountries()`, `.getStatesOfCountry(isoCode)`, `.getCitiesOfState(countryCode, stateCode)` methods
- Returns typed objects: `{ name, isoCode, phonecode, flag, ... }`
- ~6 MB unpacked, but **tree-shakes** well; only import what you need
- Widely used (2M+ weekly downloads), actively maintained, no peer deps

**Example usage:**
```typescript
import { Country, State, City } from 'country-state-city';

Country.getAllCountries()           // ICountry[]
State.getStatesOfCountry('MX')     // IState[]
City.getCitiesOfState('MX', 'ROO') // ICity[]
```

### Alternative considered: `i18n-iso-countries`
- Only countries (ISO 3166-1), no states or cities
- Rejected: incomplete for this feature

### Alternative considered: Google Places API
- Overkill; requires API key, network call, billing
- Rejected: static data is sufficient for hotel registration

---

## Key Insights

1. **Replace `location: String` with 4-5 explicit fields** — not a nested JSON object. Prisma scalar columns are easier to index and filter (e.g., `WHERE countryCode = 'MX'`).

2. **Proposed schema:**
   ```prisma
   model Hotel {
     ...
     address     String          // street address / specific location
     city        String
     state       String          // state/province name
     stateCode   String          // ISO 3166-2 state code (for lookup)
     countryCode String          // ISO 3166-1 alpha-2 (MX, US, ES...)
     country     String          // display name
     postalCode  String?         // optional
     ...
   }
   ```

3. **`country-state-city` used only on the client/form** — no need to bundle it into server code. Import only in form components for dropdown population.

4. **Backwards-compat migration**: existing `location` string data must be migrated. Options:
   - Add new columns, keep old `location` temporarily during migration, then drop
   - Or map existing free-text into `address` and pick a default country (MX for existing fixtures)

5. **Fixtures need updating**: all 4 existing hotel fixtures are in Mexico — use real MX state/city codes for deterministic test data.

6. **UI impact**: HotelCard currently shows `hotel.location` with a `MapPin` icon (`src/widgets/admin-hotels/ui.tsx` line ~63). Should render `city, country` or `city, stateCode, countryCode` for compactness.

---

## Constraints & Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking existing `location` field in DB | HIGH | Write Prisma migration carefully; keep `location` nullable temporarily or provide defaults |
| `country-state-city` bundle size (~6MB unpacked) | MEDIUM | Only import on client form components; not in server/shared layer |
| City lists are large | LOW | Lazy-load cities in form (only fetch when state is selected) |
| Phone number format varies by country | LOW | Out of scope for this feature; `phone` field stays as string |
| `stateCode` not universally applicable (e.g., some countries have no states) | LOW | Mark `state` / `stateCode` as optional in Zod (`z.string().optional()`) |

---

## Open Questions

1. **Should `location` (old field) be removed immediately or kept as derived display string?** Keeping it would simplify the mapHotel() function but adds redundancy.

2. **Postal code required or optional?** Current schema has no postal code. Required for billing/shipping integrations, otherwise optional.

3. **Should the form cascade (country → state → city dropdowns)?** Cascading UX is standard but adds complexity. Alternative: free-text city/state with country dropdown only.

4. **How to handle hotels outside Mexico?** Existing fixtures all use MX. Migration default should be `countryCode: 'MX'` for existing rows, but needs confirmation.

5. **Should org-specific location overrides be supported?** Currently org overrides only cover `contactPerson`/`contactPhone` on `HotelOrganization`. Out of scope unless explicitly requested.
