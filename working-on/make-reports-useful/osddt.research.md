# Research: Make Reports Page Useful

**Feature name**: `make-reports-useful`
**Branch**: main
**Date**: 2026-05-19

---

## Topic

The org reports page (`/org/[slug]/reports`, backed by `app/(authenticated)/reports/page.tsx`) is currently 100% hardcoded mock data. All KPI cards, charts, and tables show static numbers. "Export PDF" and "Generate weekly report" buttons just fire `alert()`. Goal: replace mocked data with real Prisma-backed aggregation queries via tRPC and wire up the UI.

---

## Codebase Findings

### Current page state (`app/(authenticated)/reports/page.tsx`)

- `monthlyData`, `musicianPerformance`, `hotelDistribution`, `conceptDistribution` — all hardcoded arrays defined inline (lines 36–65)
- KPI cards show literal numbers (58, 116, $92,800, 94%) — not derived from real data
- `generatePDFReport()` and `generateWeeklyReport()` just call `alert()` (lines 67–88)
- Does `useUnit(eventsModel.$events)` but only uses `events.length` as a multiplier for fake numbers in the PDF mock
- `org/[slug]/reports/page.tsx` is a thin re-export: `export { default } from "@/app/(authenticated)/reports/page"`

### tRPC routers available (`server/routers/`)

| Router | Relevant procedures |
|--------|-------------------|
| `events.getAll` | Cursor-paginated events with `status`, `checkedIn`, `hotel`, `musician`, `date`, `durationMinutes`, `hotelId`, `musicianId`, `bandId`. NOT suitable for aggregation (pagination) |
| `musicians.getAll` | Offset-paginated musicians with `hourlyRate`, `name`, `id` |
| `musicians.myStats` | **Auth-musician only** — current-month `performances`, `hoursWorked`, `hotels`, `punctuality`. Scoped to one musician, not org-wide |
| `admin.listUsers` | Paginated users in org with `role`, `isActive`, `createdAt` |
| `admin.listLoginHistory` | Login audit logs |
| **MISSING** | No org-level analytics/aggregation procedure exists |

### Prisma schema key fields (`Event` model)

```
date: String (YYYY-MM-DD)
durationMinutes: Int
status: String  (scheduled | in-progress | completed | cancelled)
checkedIn: Boolean
hotel: String   (denormalized name)
hotelId: String? (FK)
musician: String? (denormalized name)
musicianId: String? (FK)
bandId: String? (FK)
organizationId: String
```

`Musician` model: `hourlyRate: Float`

### Org-scoped procedure type: `managerProcedure`

From `server/trpc.ts` — `managerProcedure` (role: manager | superadmin) includes `ctx.organizationId`. Used in `admin.*`. This is the right procedure type for org-level reports.

### FSD / SDD structure

Per CLAUDE.md SDD rules, the workflow is:
1. `specs/entities/` — Zod schema if new type
2. `specs/fixtures/` — deterministic fixture data
3. `specs/features/` — behavior scenarios
4. `features/*/model.ts` — Effector model
5. `__tests__/features/` — tests
6. `app/` or `widgets/` — UI

---

## Critical Business Logic (from user)

> "Prices per member of band could be different. Hotel price is not related to the band/musician price — the ORG could charge more or less to the hotel and pay more or less to the band/members. That's really important for reports, since from reports we'll make and request payments."

This defines a **dual-ledger model**:
- **Revenue side**: What the org charges each hotel per event (`hotelFee`)
- **Cost side**: What the org pays each performer per event (`performerFee` — per musician, per band member)
- **Margin**: Revenue − Cost = org profit per event / period

Reports are not just analytics dashboards — they are **the source of truth for generating payment requests** (invoice hotel → org, org → musician).

---

## Key Insights

### 1. SCHEMA GAP — Event has no pricing fields at all

The `Event` model currently has **zero financial fields**:
```prisma
// Event model — MISSING:
hotelFee        Float?   // what hotel pays the org (revenue)
// No performerFee either
```

`Musician.hourlyRate` is a **global flat rate** on the musician record — not per-event, not per-org-negotiated. It cannot capture:
- Org paying a musician more/less than their default rate for a specific event
- Different rates for the same musician at different hotels

`HotelOrganization` join table only stores `contactPerson` + `contactPhone` — no rate or pricing.

`BandMember` join table has no rate override — member rates default to `Musician.hourlyRate`.

**Conclusion**: Before any reports logic can work, `prisma/schema.prisma` must be migrated to add per-event pricing fields.

### 2. Pricing workflow decisions (confirmed by user)

**Pricing entry**: Combination of suggestion + separate "set pricing" step.
- At event creation: no required pricing fields — booking is independent of pricing
- After booking: a dedicated "Set Pricing" action on the event suggests prices and lets the manager confirm/override
- Suggestion sources:
  - `hotelFee` suggestion → last `hotelFee` charged to that hotel by this org (historical average), falling back to `HotelOrganization.defaultRate` if we add one
  - `performerCost` suggestion → `Musician.hourlyRate × durationMinutes / 60` per member (summed for bands)
- Manager can accept suggestions or override before saving

**Null fee handling**: Use estimations in reports UI. If no confirmed price AND no hourlyRate to estimate from, flag the event clearly in the UI as "Sin precio / unpriced".

**Three pricing states for any event**:
1. **Confirmed** — manager explicitly set `hotelFee` / performer payments (green, used in totals as-is)
2. **Estimated** — no confirmed price, but `Musician.hourlyRate` available → derive estimate (yellow, shown as "~$X est.")
3. **Unpriced** — no confirmed price AND no hourlyRate → flag in UI (red/warning badge "Sin precio")

### 3. Proposed schema additions

**Schema philosophy**: Store rate defaults on org-level join tables, snapshot agreed prices on each Event. Two layers:

**Layer 1 — Default rates on join tables** (used for suggestions)

```prisma
model HotelOrganization {
  // ... existing fields ...
  defaultHourlyRate Float?   // what org typically charges this hotel per hour of performance
}

model MusicianOrganization {
  // ... existing fields ...
  orgRate Float?   // what this org pays this musician per hour (overrides Musician.hourlyRate for this org)
}
```

`orgRate` on `MusicianOrganization` allows the org to pay a musician differently than their global `hourlyRate` — e.g., higher rate for a premium hotel, or negotiated org-specific contract.

**Layer 2 — Snapshot pricing on Event** (confirmed at "set pricing" step)

```prisma
model Event {
  // ... existing fields ...
  hotelFee      Float?   // confirmed: what hotel pays org for this event (revenue)
  pricingStatus String   @default("pending")  // 'pending' | 'confirmed'
}
```

`hotelFee` is set by manager. `pricingStatus = 'confirmed'` means manager reviewed and locked prices.

**Layer 3 — Per-performer payment records** (per-member breakdown, set at same time as hotelFee)

```prisma
model EventPerformerPayment {
  id              String    @id @default(cuid())
  eventId         String
  musicianId      String
  agreedRate      Float     // snapshot of negotiated hourly rate at time of pricing
  durationMinutes Int       // mirrors event.durationMinutes
  total           Float     // agreedRate * durationMinutes / 60
  isPaid          Boolean   @default(false)
  paidAt          DateTime?
  createdAt       DateTime  @default(now())

  event    Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  musician Musician @relation(fields: [musicianId], references: [id])

  @@unique([eventId, musicianId])
  @@index([eventId])
  @@index([musicianId])
  @@index([isPaid])
}
```

When manager hits "Set Pricing" on an event:
1. `Event.hotelFee` is saved
2. `Event.pricingStatus` → `'confirmed'`
3. One `EventPerformerPayment` row per performer (musician solo OR each band member)
4. `agreedRate` defaults to `MusicianOrganization.orgRate ?? Musician.hourlyRate`

### 4. Payment request generation flow

From the reports page:
1. Manager selects period
2. Reports show: events per hotel with `hotelFee` totals (confirmed + estimated) → "Request payment from hotel"
3. Reports show: events per musician with `EventPerformerPayment.total` sums (confirmed + estimated) → "Generate payment order"
4. Unpriced events flagged with "Sin precio" badge — clicking navigates to Set Pricing step
5. "Request payment" / "Generate payment order" → export (CSV/PDF stub for now, real invoice later)

### 5. Per-band-member payment breakdown

When `bandId` is set on an event:
- Load all `BandMember` records for that band (at time of pricing)
- Each member's rate: `MusicianOrganization.orgRate ?? Musician.hourlyRate`
- One `EventPerformerPayment` row per member — rates **can and will differ**
- Total performer cost for event = sum of all member rows

Example: 3-piece band, 2h set
- Lead guitarist: $800/h → $1,600
- Bassist: $600/h → $1,200
- Drummer: $600/h → $1,200
- Total performer cost: $4,000
- Hotel fee charged: $6,000
- Org margin: $2,000

### 5. Period selector already exists in UI

`selectedPeriod` (week/month/quarter/year) + `selectedYear` state already exist. Map to date range for backend query.

### 6. Recharts + shadcn/ui already installed

`recharts`, `BarChart`, `LineChart`, `PieChart` already imported and working. No new dependencies needed.

### 7. `musicians.myStats` pattern to follow

`server/routers/musicians.ts:254` shows the Prisma date-range aggregation pattern. Org-stats query follows same style scoped to `organizationId`.

---

## Constraints & Risks

| Item | Risk |
|------|------|
| **Schema migration required** | Medium — `Event` needs `hotelFee`, `performerCost`; new `EventPerformerPayment` table |
| **Existing events have null fees** | High — all seeded/existing events will have `null` pricing; reports must handle null gracefully |
| `Event.date` stored as string `YYYY-MM-DD` | Low — string comparison already used in `myStats` |
| Band member payments at booking time | Medium — need to auto-populate `EventPerformerPayment` rows when event is created with a `bandId` |
| PDF/invoice export | Out of scope for now — keep as stub |
| SDD: need scenario + spec files | Must add `specs/features/reports.scenarios.ts` |
| No existing `$reports` Effector store | Add `loadOrgStatsFx` to new `features/reports/model.ts` |

---

## Open Questions

1. **`MusicianOrganization.orgRate` vs `Musician.hourlyRate`**: Should we add `orgRate` to the join table for org-specific negotiated rates, or keep a single global `hourlyRate` on `Musician`? → Leaning toward adding `orgRate` for precision.
2. **Set Pricing UX location**: Where does the "Set Pricing" form live — on the event detail page (inline section), or a separate modal/drawer on the reports page?
3. **Payment request record**: `PaymentRequest` model now or export CSV stub first?
4. **Date range scope**: Arbitrary date picker or preset periods only (week/month/quarter/year)?
5. **Musician role visibility**: Does a musician user see their own `EventPerformerPayment` rows (what they'll be paid), or just their schedule?
6. **Pricing lock**: Once `pricingStatus = 'confirmed'`, can it be edited? Or is it immutable (requires a correction entry)?

---

## Implementation Plan (high level)

```
Phase 1 — Schema & data model
  1. prisma/schema.prisma
       — add HotelOrganization.defaultHourlyRate Float?
       — add MusicianOrganization.orgRate Float?
       — add Event.hotelFee Float?, Event.pricingStatus String ('pending'|'confirmed')
       — add EventPerformerPayment model
  2. prisma migration (pnpm prisma migrate dev)
  3. specs/entities/event.schema.ts    — add hotelFee, pricingStatus to EventSchema
  4. specs/entities/                   — new EventPerformerPaymentSchema

Phase 2 — Pricing backend
  5. server/routers/events.ts
       — add setPricing managerProcedure:
           input: { eventId, hotelFee, performers: [{ musicianId, agreedRate }] }
           creates EventPerformerPayment rows, sets Event.pricingStatus = 'confirmed'
       — add getSuggestedPricing managerProcedure:
           input: { eventId }
           output: { hotelFee: suggested Float|null, source: 'historical'|'default'|null,
                     performers: [{ musicianId, name, rate: Float, source: 'orgRate'|'hourlyRate' }] }

Phase 3 — Reports backend
  6. server/routers/reports.ts    — new router with getOrgStats (managerProcedure)
       — Input: { period: 'week'|'month'|'quarter'|'year', year?: number }
       — Output: {
           kpis: { events, hotelRevenue, performerCost, margin, checkinRate,
                   confirmedCount, estimatedCount, unpricedCount },
           monthlyTrend: [{ month, events, hotelRevenue, performerCost }],
           byHotel: [{ hotelId, name, events, revenue, pricingStatus }],
           byMusician: [{ musicianId, name, events, hours, cost, isPaid, pricingStatus }]
         }
  7. server/routers/index.ts      — register reports router

Phase 4 — Frontend
  8. specs/features/reports.scenarios.ts  — behavior scenarios
  9. features/reports/model.ts    — Effector model with loadOrgStatsFx
 10. app/(authenticated)/reports/page.tsx — wire real data, remove mock arrays
     — three states per amount: confirmed / ~estimated / Sin precio badge
     — "Set Pricing" button on unpriced events
 11. __tests__/features/reports.test.ts   — unit tests

Phase 5 — Set Pricing UX
 12. Event detail / drawer        — Set Pricing form with pre-filled suggestions
     — hotelFee input (suggested value pre-filled, editable)
     — per-performer table (one row per musician/band member, rate editable)
     — "Confirm pricing" saves EventPerformerPayment rows
```

No new npm packages required.

