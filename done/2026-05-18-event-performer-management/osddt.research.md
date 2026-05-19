# Research: Event Performer Management

**Branch**: main  
**Date**: 2026-05-18  
**Feature name**: `event-performer-management`

---

## Topic

The current event creation flow allows assigning only a **single musician** to an event. The goal is to support:

1. **Bands** — a named group of multiple musicians performing together at one event
2. **Solo + Band duality** — the same musician can participate in an event solo AND in a band at a different time slot on the same day

---

## Codebase Findings

### Prisma Schema (`prisma/schema.prisma`)

```prisma
model Event {
  id          String    @id @default(cuid())
  musician    String?   // denormalized display name
  musicianId  String?   // FK — SINGLE musician only
  musicianRel Musician? @relation(fields: [musicianId], references: [id])
  ...
}

model Musician {
  id     String   @id @default(cuid())
  events Event[]  // one-to-many
  ...
}

model MusicianOrganization {
  musicianId     String
  organizationId String
  @@id([musicianId, organizationId])
}
```

**No Band model exists.** Zero references to "band" in the schema or codebase.

### Zod Schemas

**`entities/event/schema.ts`**
```ts
EventSchema = z.object({
  musician:   z.string().optional(),   // display name — single
  musicianId: z.string().optional(),   // FK — single
  ...
})
```

**`entities/musician/schema.ts`**
```ts
MusicianSchema = z.object({
  shows: z.array(z.string()).min(1),  // ["Jazz Trio", "Acoustic Set"]
  hourlyRate: z.number().positive(),
  isActive: z.boolean(),
  ...
})
```

The `shows` field hints at "set types" per musician but is not connected to the Band concept.

### Event Creation Form (`widgets/admin-events/ui.tsx`)

- Single `<Select>` dropdown for musician assignment
- One musician per event, required field
- No multi-select, no group/band concept

### Conflict Detection (`entities/event/lib.ts`)

```ts
// Only checks: same musicianId + time overlap
if (event.musicianId !== candidate.musicianId) return false
return eventsOverlap(candidate, event)
```

This needs to change: conflict detection must account for musicians belonging to bands booked at the same time.

### tRPC Router (`server/routers/events.ts`)

- Validates `musicianId` against `MusicianOrganization` join table
- Returns 400 if musician not linked to org
- Single-musician assignment only

### State Management (`features/events/model.ts`)

- Effector stores: `$events`, `$todayEvents`, `$upcomingEvents`
- Event CRUD wired to tRPC effects
- No performer-group concept

### Fixtures (`specs/fixtures/`)

- 3 musicians: Carlos Mendoza, Ana Rodríguez, Miguel Santos
- Each event has exactly one `musicianId`
- `shows` per musician: e.g. "Jazz Trio", "Acoustic Set", "Guitar Solo"

---

## Key Insights

### 1. Two performer modes needed

| Mode | Description |
|------|-------------|
| **Solo** | A single musician booked as an individual |
| **Band** | A named group of 2+ musicians booked together as a unit |

An event should link to **one performer slot** — either a solo musician or a band. Not mixed.

### 2. The Band entity is missing entirely

No `Band` model, no `BandMember` join table. Both need to be added to Prisma and the Zod spec layer.

### 3. Performer concept as an abstraction

The cleanest data model: introduce a **`Performer`** concept that wraps either a solo musician or a band. An event links to a `Performer`.

Alternative (simpler): keep `Event → Musician` for solo, add `Event → Band` FK, make them mutually exclusive. This avoids a polymorphic join but adds nullable FKs.

### 4. A musician can be in multiple bands

`Band` ↔ `Musician` is many-to-many. Need `BandMember` join table.

### 5. Conflict detection must expand

Current: checks `musicianId` overlap.  
Future: must also check if a musician is a member of a band booked at the same time. A guitarist booked solo at 6pm can't also be in a band booked at 6pm.

### 6. Display name denormalization pattern exists

`Event.musician` (string) stores the display name alongside `musicianId`. The same pattern should be used for bands: `Event.performerName` + `Event.bandId` (or equivalent).

### 7. `shows` field on Musician is a list of set types

Probably should link a Musician's "show type" to what they perform within a band (e.g., "guitarist in Jazz Trio"). This could inform the spec for `BandMember.role`.

---

## Constraints & Risks

| Constraint | Detail |
|------------|--------|
| **SDD rule** | Schema changes must go to `specs/entities/` first, then Prisma, then code |
| **No breaking changes to Event.musicianId** | Existing events use this FK — migration must be additive |
| **Conflict detection complexity** | Naive musician-ID check breaks when musicians are in bands |
| **tRPC input validation** | `createEvent` input shape changes — all callers need updating |
| **Fixtures must be updated** | `specs/fixtures/` must include bands and band-member musicians |
| **MusicianOrganization join table** | Bands also need org-scoping: `BandOrganization` join table needed |
| **Denormalized display name** | `Event.musician` is a free string — band display equivalent needed |
| **UI change** | Admin event form needs a performer picker that handles both modes |

---

## Open Questions

1. **Performer abstraction or dual FKs?**  
   Should we introduce a `Performer` polymorphic entity, or use two nullable FKs on `Event` (`musicianId` | `bandId`) with a check constraint?  
   → Dual FK is simpler for Prisma + tRPC; Performer abstraction is cleaner long-term.

2. **Can a band exist across organizations?**  
   Like `MusicianOrganization`, do we need `BandOrganization`? Or is a band always org-scoped?  
   → Most likely org-scoped, but needs confirmation.

3. **What fields does a Band need?**  
   - `name` (required)  
   - `genre`? `description`? `avatar`?  
   - `hourlyRate` — per band or per member?

4. **Does band membership change per event?**  
   Can a band book a show with only 3 of 5 members? Or is the band roster fixed?  
   → Probably fixed roster, lineup variations out of scope for v1.

5. **UI picker flow**  
   Should the event form have: (a) a toggle "Solo / Band" then show respective pickers, or (b) a unified search across both musicians and bands?

6. **Conflict detection scope**  
   If guitarist is in Band A (booked 6–8pm) can they also play solo at 9pm same day, different hotel? Current answer: yes (no hotel-level conflict). Should we change this?

7. **`shows` field on Musician — keep or replace?**  
   Current `shows: string[]` seems to represent "types of sets a musician plays." Does this map to BandMember roles, or is it separate?

8. **Backward compatibility for existing events**  
   Events with `musicianId` but no `bandId` — how do they render in the new UI? As "solo" performer mode implicitly?

---

## Files to Change (anticipated)

| File | Change |
|------|--------|
| `specs/entities/musician.schema.ts` | Add `bands?: Band[]` (after Band schema created) |
| `specs/entities/event.schema.ts` | Add `bandId`, `performerMode: 'solo' \| 'band'`, `performerName` |
| `specs/entities/band.schema.ts` | **NEW** — Band + BandMember schemas |
| `specs/fixtures/index.ts` | Add band fixtures |
| `specs/features/events.scenarios.ts` | Add scenarios for band booking |
| `prisma/schema.prisma` | Add `Band`, `BandMember`, `BandOrganization` models; update `Event` |
| `server/routers/events.ts` | Handle `bandId` in create/update, conflict detection |
| `features/events/model.ts` | Update Effector model for performer mode |
| `widgets/admin-events/ui.tsx` | Performer picker (solo vs band) |
| `__tests__/features/events.test.ts` | Tests for band booking scenarios |
