# Research: Event Sets, Pricing & Reports

**Feature name**: `event-sets-pricing-reports`
**Date**: 2026-05-22
**Branch**: `icaamal/feat-better-roles`

---

## Topic

Replace the abstract `durationMinutes` field on events with a human-readable **"sets"** concept (1 set = 1 hour). Sets drive automated pricing calculations (musician/band cost per event) and feed real billing reports for hotels and internal oversight. This eliminates hardcoded mock data from the reports page and ties financial figures to actual event data.

---

## Codebase Findings

### Event Entity — `durationMinutes`

| Location | Detail |
|---|---|
| `prisma/schema.prisma:269` | `durationMinutes Int` — stored as integer minutes |
| `src/entities/event/schema.ts:7,17` | Zod: `z.number().int().positive().max(12 * 60)` |
| `src/widgets/admin-events/ui.tsx:229-239` | Form select: 60 / 90 / 120 / 180 min options |
| `src/widgets/admin-events/ui.tsx:68,120,164` | `String(event.durationMinutes)` ↔ `Number(durationMinutes)` conversions |
| `src/entities/event/lib.ts:10-11` | `getEventEndDate()` — `addMinutes(start, event.durationMinutes)` |
| `src/entities/event/lib.ts:13-18` | `getEventTimeLabel()` — builds HH:MM–HH:MM label |
| `src/entities/event/lib.ts:71-74` | `eventsOverlap()` — conflict detection uses durationMinutes |
| `src/entities/event/lib.ts:133-138` | `getCalendarSummary()` — `estimatedHours = total durationMinutes / 60` |
| `src/server/routers/events.ts:338` | Create: `durationMinutes: input.durationMinutes` |
| `src/server/routers/events.ts:409` | Update: partial `durationMinutes` |
| `src/specs/features/events.scenarios.ts:128-137` | Scenario: "calendar end derived from durationMinutes" |
| `src/specs/fixtures/events.ts` | Fixtures use 60, 90, 120 min values |

**Key constraint**: `getEventEndDate` and `eventsOverlap` both rely on `durationMinutes`. Sets must map cleanly (1 set = 60 min) so these functions keep working — either by converting sets→minutes internally or by storing `sets` and deriving minutes.

### Musician Pricing — `hourlyRate`

| Location | Detail |
|---|---|
| `prisma/schema.prisma:194` | `hourlyRate Float` on Musician |
| `prisma/schema.prisma:37` | `hourlyRate Float?` on User (denormalized, nullable) |
| `src/entities/musician/schema.ts:10` | `hourlyRate: z.number().positive()` |
| `src/server/routers/musicians.ts:115-141` | Create: `hourlyRate: input.hourlyRate` |
| `src/specs/fixtures/musicians.ts` | Carlos: 800, Ana: 750, Miguel: 900 |

`hourlyRate` is exactly what a "price per set" would be (1 hour = 1 set). The rename is semantic and backward-compatible in calculations: `price = musician.pricePerSet × event.sets`.

### Band Pricing

| Location | Detail |
|---|---|
| `src/entities/band/schema.ts:1-24` | Band has `name`, `members` (musician IDs), `styles` — **no rate field** |
| `prisma/schema.prisma:148-161` | Band model: no pricing |

Band pricing must be derived. Two options:
1. **Aggregate**: Sum member musician rates (already have `hourlyRate` per member).
2. **Explicit**: Add `pricePerSet` to Band model.

### Event Price Field

| Location | Detail |
|---|---|
| `prisma/schema.prisma:269` | `price Float?` — nullable, manually set today |
| `src/entities/event/schema.ts:25` | `price: z.number().nullable().optional()` |
| `src/server/routers/events.ts:463-469` | Audit log tracks price changes (`priceChange.from`, `priceChange.to`) |

Today `price` is set manually or left null — no automated calculation. This is the target for auto-calculation: `event.price = performerRate × event.sets`.

### Reports Page

| Location | Detail |
|---|---|
| `src/app/(authenticated)/reports/page.tsx:36-65` | **100% hardcoded mock data** — no DB queries |
| KPI cards | Total events, hours worked, estimated payment, check-in rate |
| Tab: Por Músico | musician name, eventos, horas, pago (mock) |
| Tab: Por Hotel | event distribution by hotel (mock) |
| Tab: Resumen | Monthly chart with `horas` and `pago` (mock) |

All monetary figures are fake. This feature is the opportunity to replace them with real calculations derived from `sets × pricePerSet`.

### Hotel Billing

No dedicated hotel billing table or model exists. Hotels link to events via `Event.hotelId`. The reports page has a "Por Hotel" tab but shows only event counts, not costs. There is no invoice or billing record for what a hotel owes.

### Conflict Detection & Calendar

`eventsOverlap()` uses `getEventEndDate()` which calls `addMinutes(start, durationMinutes)`. If sets replaces durationMinutes, `getEventEndDate` needs to accept `sets * 60` as the minute value — or the helper converts internally.

### Audit Logging

`EventAuditLog` tracks `DURATION_CHANGE` (if present) and `PRICE_CHANGE`. Sets changes should be tracked similarly.

---

## External References

- No third-party billing/invoicing library currently in use.
- `date-fns` already used for time arithmetic (`addMinutes`, `differenceInMinutes`).
- Prisma migrations already in place under `prisma/migrations/`.

---

## Key Insights

1. **"Sets" is purely semantic** — 1 set = 60 minutes. The database can store `sets` as `Int` and all existing time arithmetic keeps working via `sets * 60`. No loss of precision since the current options (60, 90, 120, 180 min) don't all map to whole sets — **90 min = 1.5 sets is problematic**. Must decide: drop 90-min option, or allow half-sets (Float), or keep `durationMinutes` in DB and only expose "sets" in UI as a display alias for whole-hour increments.

2. **90-minute option is the key decision** — current fixtures include 90-min events. If sets must be integers (1, 2, 3…), 90-min events break. If half-sets (0.5, 1, 1.5…) are allowed, the concept gets less clean. Recommended: drop 90 min as an option, allow only 1, 2, 3, 4… sets. Migrate existing 90-min events → 2 sets (round up) or 1 set (round down) — spec must decide.

3. **Auto-price calculation** — once sets is defined and musician/band rate is known at event creation, `price` can be auto-populated. This is the main value add: removes manual pricing errors.

4. **Band pricing gap** — Band has no rate. Either add `pricePerSet` to Band or aggregate from members. Aggregation is more accurate but requires all band members to have rates set.

5. **Reports are 100% fake** — the entire reports page needs real queries. The sets-based model enables: `musician.pricePerSet × event.sets = event cost`, summed by month/hotel/musician.

6. **Hotel "charge" perspective** — hotels pay for events. Musician/band "receive" payment. These are two sides of the same figure (assuming hotel pays = musician receives + margin). The spec must clarify if there's a markup or if they're the same number.

---

## Constraints & Risks

| Constraint | Details |
|---|---|
| 90-min existing events | 90-min fixtures/events don't map to whole sets — migration decision required |
| Band pricing model | Band has no rate; must add field or implement aggregation logic |
| Reports page rewrite | All mock data must be replaced; needs real tRPC procedures returning aggregated event data |
| `eventsOverlap` | Must handle sets-based duration correctly; currently assumes minutes |
| User.hourlyRate denormalization | If renaming `hourlyRate` → `pricePerSet`, the User model field must also be updated |
| Audit log | Should track `SETS_CHANGE` (renamed from `DURATION_CHANGE`) |
| Prisma migration | Renaming `durationMinutes` requires a migration; can be additive (add `sets`, deprecate `durationMinutes`) or a clean rename |

---

## Open Questions

1. **Half-sets allowed?** Can an event be 1.5 sets (90 min)? Or only integer sets?
2. **Band rate strategy**: Add explicit `pricePerSet` to Band, or aggregate member rates? What if a band has no members with rates set?
3. **Hotel charge = musician pay?** Is the amount the hotel is charged the same as what the musician receives, or is there an org margin/markup?
4. **Rename in DB or add new field?** Additive migration (keep `durationMinutes`, add `sets`) vs clean rename migration.
5. **Reports data source**: Should reports use real-time DB queries or a pre-aggregated summary table?
6. **Price auto-calculation UX**: Auto-populate `price` on form when performer + sets is known? Or calculate on the fly for display only, storing separately?
7. **Historical events**: How to handle events created before this feature (no sets, or 90-min events)?
