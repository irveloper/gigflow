# Plan: Event Performer Management

**Feature**: `event-performer-management`  
**Date**: 2026-05-18  
**Stack**: Next.js 15 · Prisma · tRPC · Effector · Zod · shadcn/ui · SDD spec-first

---

## Architecture Overview

### Data model decision: dual nullable FKs (not polymorphic Performer abstraction)

`Event` gains two nullable FKs — `musicianId` and `bandId` — exactly one of which is set per event. Performer type is derived from which FK is populated, no explicit `performerType` field needed. Existing events have `musicianId` set → automatically treated as solo. This mirrors the existing `hotelId` / `hotel` (display name) denormalization pattern already used for hotels and musicians.

```
Event
  musicianId?  → Musician (solo)
  musician?    → denormalized display name (solo)
  bandId?      → Band (band booking)
  band?        → denormalized display name (band booking)
  [ exactly one of musicianId or bandId must be non-null ]
```

### Band model

```
Band
  id, name, description?, genre?, isActive, createdAt

BandMember (join table — Musician ↔ Band, many-to-many)
  bandId, musicianId
  [ minimum 2 members enforced at application layer ]

BandOrganization (join table — Band ↔ Organization, many-to-many)
  bandId, organizationId
  [ same pattern as MusicianOrganization ]
```

### Musician schema change

Replace `shows: string[]` with:
- `instruments: string[]` — what the musician plays (e.g. "Guitar", "Piano")
- `styles: string[]` — musical genres (e.g. "Jazz", "Flamenco")

Both fields apply identically to `Musician` in Prisma and the Zod schema. `User.shows` is renamed to `User.instruments` + `User.styles` for consistency (User mirrors Musician profile fields).

### Conflict detection

Authoritative conflict detection is **server-side** (in tRPC `create`/`update`) because it requires DB queries to resolve band memberships. The algorithm:

```
Solo booking (musicianId M):
  1. Load all non-cancelled events on same date in the org
  2. Conflict if any event overlaps AND:
     a. event.musicianId === M  (solo vs solo)
     b. event.bandId is set AND band has M as member  (solo vs band)

Band booking (bandId B):
  1. Load members of band B → [M1, M2, ...]
  2. Load all non-cancelled events on same date in the org
  3. Conflict if any event overlaps AND:
     a. event.musicianId is in [M1, M2, ...]  (band vs solo)
     b. event.bandId is set AND that band shares any member with B  (band vs band)
```

Client-side `getSchedulingConflicts` in `entities/event/lib.ts` is updated to accept an optional `bandMemberIds` map for UI pre-validation.

### SDD workflow order

Per CLAUDE.md: specs/entities → prisma → fixtures → scenarios → feature models → tests → UI.

---

## Implementation Phases

### Phase 1 — Zod Schemas (specs/entities/)

**Goal**: establish single source of truth for all new types before any other code changes.

1. **`specs/entities/band.schema.ts`** — NEW file:
   ```ts
   BandSchema = z.object({
     id: z.string(),
     name: z.string().min(1),
     description: z.string().optional(),
     genre: z.string().optional(),
     isActive: z.boolean().default(true),
     createdAt: z.string().datetime({ offset: true }),
     members: z.array(z.string()).optional(), // musician IDs
   })
   BandMemberSchema = z.object({ bandId: z.string(), musicianId: z.string() })
   CreateBandInputSchema = BandSchema.omit({ id: true, createdAt: true })
   ```

2. **`entities/musician/schema.ts`** — replace `shows` with `instruments` + `styles`:
   ```ts
   instruments: z.array(z.string()).min(1),
   styles: z.array(z.string()).min(1),
   // remove: shows: z.array(z.string()).min(1)
   ```

3. **`entities/event/schema.ts`** — add band fields alongside existing musician fields:
   ```ts
   band: z.string().optional(),     // denormalized band display name
   bandId: z.string().optional(),   // FK to Band
   ```
   Update `CreateEventInputSchema` to include these fields.

4. **`specs/entities/index.ts`** — re-export Band types.

5. **`shared/types/index.ts`** — re-export `Band`, `BandMember`, `CreateBandInput`.

---

### Phase 2 — Prisma Schema + Migration

**Goal**: database reflects new entities.

1. **`prisma/schema.prisma`** — add models:
   ```prisma
   model Band {
     id          String   @id @default(cuid())
     name        String
     description String?
     genre       String?
     isActive    Boolean  @default(true)
     createdAt   DateTime @default(now())

     members       BandMember[]
     organizations BandOrganization[]
     events        Event[]

     @@index([isActive])
   }

   model BandMember {
     bandId     String
     musicianId String
     band       Band     @relation(fields: [bandId], references: [id], onDelete: Cascade)
     musician   Musician @relation(fields: [musicianId], references: [id], onDelete: Cascade)
     @@id([bandId, musicianId])
   }

   model BandOrganization {
     bandId         String
     organizationId String
     band           Band         @relation(fields: [bandId], references: [id], onDelete: Cascade)
     organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
     @@id([bandId, organizationId])
   }
   ```

2. **`prisma/schema.prisma`** — update existing models:
   - `Musician`: rename `shows String[]` → `instruments String[] @default([])` + add `styles String[] @default([])`; add `bands BandMember[]` reverse relation
   - `Event`: add `band String?` (display name) + `bandId String?` (FK) + `bandRel Band? @relation(...)` 
   - `Organization`: add `bands BandOrganization[]` reverse relation
   - `User`: rename `shows` → `instruments`, add `styles String[] @default([])`

3. Run `prisma migrate dev --name add-band-performer-model`

4. **`prisma/seed.ts`** — add sample bands with members using seeded musicians.

---

### Phase 3 — Fixtures + Scenarios

**Goal**: deterministic test data before writing any feature logic.

1. **`specs/fixtures/musicians.ts`** — update all musician fixtures:
   - rename `shows` → `instruments` (keep instrument names)
   - add `styles: ["Jazz", "Flamenco", etc.]` per musician

2. **`specs/fixtures/bands.ts`** — NEW file:
   ```ts
   export const jazzTrio: Band = { id: "band-1", name: "Jazz Trio", genre: "Jazz", isActive: true, ... }
   export const flamencoGroup: Band = { ... }
   export const allBands: Band[] = [jazzTrio, flamencoGroup]
   ```
   Include band members linking to fixture musicians.

3. **`specs/fixtures/index.ts`** — export `allBands`, `jazzTrio`, `flamencoGroup`.

4. **`specs/features/events.scenarios.ts`** — add scenarios:
   - `book band for event` — happy path
   - `conflict: solo musician already in band at same time`
   - `conflict: band member already booked solo`
   - `conflict: band member in another band at same time`
   - `no conflict: same musician, non-overlapping slots`

5. **`specs/features/musicians.scenarios.ts`** — update scenarios referencing `shows` to use `instruments`/`styles`.

---

### Phase 4 — Backend: tRPC Routers

**Goal**: API layer supports bands and expanded conflict detection.

1. **`server/routers/bands.ts`** — NEW router with procedures:
   - `getAll` — org-scoped, active bands only (with members included)
   - `getById` — org-scoped
   - `create` — validates ≥2 members, links to org via `BandOrganization`
   - `update` — name, description, genre
   - `addMember` — adds musician to band (validates musician is in org)
   - `removeMember` — removes musician, validates band still has ≥2 members after removal
   - `deactivate` — soft delete (sets `isActive: false`)

2. **`server/routers/events.ts`** — update `create` and `update`:
   - Add `bandId` to input validation (mutually exclusive with `musicianId`)
   - Validate `bandId` against `BandOrganization` (same pattern as hotel/musician validation)
   - Implement server-side conflict detection algorithm (see Architecture Overview)
   - Update `mapEvent` to include `band` and `bandId` fields
   - Expand `getAll` musician view: musicians see events where they are solo performer OR a member of the booked band

3. **`server/routers/musicians.ts`** — update field mappings: `shows` → `instruments` + `styles` in create, update, and map functions.

4. **`server/routers/index.ts`** — register `bandsRouter`.

---

### Phase 5 — Conflict Detection Lib

**Goal**: update client-side scheduling lib to handle band events.

**`entities/event/lib.ts`** — update `getSchedulingConflicts`:

```ts
export const getSchedulingConflicts = ({
  candidate,
  events,
  ignoreEventId,
  // Map of bandId → musicianId[] for any bands referenced in events
  bandMemberIds = {},
}: {
  candidate: Event
  events: Event[]
  ignoreEventId?: string
  bandMemberIds?: Record<string, string[]>
}) =>
  events.filter((event) => {
    if (event.id === ignoreEventId || event.id === candidate.id) return false
    if (event.status === "cancelled") return false
    if (!eventsOverlap(candidate, event)) return false

    const candidateMusicianId = candidate.musicianId
    const candidateBandMembers = candidate.bandId ? bandMemberIds[candidate.bandId] ?? [] : []

    const eventMusicianId = event.musicianId
    const eventBandMembers = event.bandId ? bandMemberIds[event.bandId] ?? [] : []

    // solo vs solo
    if (candidateMusicianId && eventMusicianId && candidateMusicianId === eventMusicianId) return true
    // solo vs band
    if (candidateMusicianId && eventBandMembers.includes(candidateMusicianId)) return true
    // band vs solo
    if (eventMusicianId && candidateBandMembers.includes(eventMusicianId)) return true
    // band vs band (any shared member)
    if (candidateBandMembers.some((id) => eventBandMembers.includes(id))) return true

    return false
  })
```

Note: The authoritative check is always server-side. This lib function is for UI pre-validation only.

---

### Phase 6 — Feature Models (Effector)

**Goal**: client-side state management for bands.

1. **`features/bands/model.ts`** — NEW Effector model:
   - `$bands` store
   - `loadBandsFx`, `createBandFx`, `updateBandFx`, `addMemberFx`, `removeMemberFx`, `deactivateBandFx`
   - Wire to tRPC via `shared/api/bands.ts`

2. **`shared/api/bands.ts`** — NEW tRPC client procedures (mirrors pattern of `shared/api/musicians.ts`).

3. **`features/events/model.ts`** — update:
   - Event type now includes `band?` and `bandId?`
   - Conflict detection calls updated to pass `bandMemberIds` map

4. **`features/musicians/model.ts`** — update field references from `shows` to `instruments`/`styles`.

---

### Phase 7 — UI

**Goal**: admin can manage bands and book performers.

1. **`widgets/admin-events/ui.tsx`** — update event creation/edit form:
   - Replace single musician `<Select>` with performer picker:
     ```
     [ Solo Musician ▾ ]  [ Band ▾ ]   ← radio/tab toggle
     ↓ (if Solo selected)
     <Select> musician list
     ↓ (if Band selected)  
     <Select> band list (active only)
     ```
   - Mutually exclusive: selecting one clears the other
   - Display performer name in event detail view (musician name or band name)

2. **`widgets/admin-bands/ui.tsx`** — NEW widget for band management:
   - List of bands with member count, genre, active status
   - Create band form: name, description, genre, member picker (multi-select from org musicians)
   - Member management: add/remove musicians inline
   - Deactivate band action

3. **`widgets/admin-musicians/ui.tsx`** — update musician form:
   - Replace `shows` input with `instruments` (multi-input tags) and `styles` (multi-input tags)

4. **`widgets/event-list/ui.tsx`** — update performer display:
   - Show `event.musician ?? event.band ?? "—"` as performer name

5. **`widgets/calendar/ui.tsx`** — update event tooltip/detail:
   - Show performer name (musician or band) correctly

6. **Admin bands page** — `app/org/[slug]/admin/bands/page.tsx` — NEW page hosting the `admin-bands` widget.

7. **`widgets/navigation/ui.tsx`** — add "Bandas" link to org admin nav.

---

### Phase 8 — Tests

**Goal**: test coverage for all new scenarios.

1. **`__tests__/features/events.test.ts`** — add tests matching new scenarios:
   - Band booking happy path
   - Conflict: solo musician in overlapping band event
   - Conflict: band member already booked solo
   - Conflict: shared band member in two band events
   - No conflict: non-overlapping solo + band slots for same musician

2. **`__tests__/features/bands.test.ts`** — NEW test file:
   - Create band with ≥2 members
   - Reject band with <2 members
   - Add/remove members
   - Deactivate band

3. **`__tests__/features/musicians.test.ts`** — update tests for `instruments`/`styles` replacing `shows`.

---

## Technical Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Prisma | DB schema + migration | Already in use |
| tRPC | API router for bands | New router needed |
| Effector | Client-side band state | New model needed |
| Zod | Band + updated musician/event schemas | New schema file |
| shadcn/ui `<Select>`, `<RadioGroup>` | Performer toggle + picker UI | Already in use |
| `date-fns` | Conflict overlap calculation | Already in use |

No new npm packages required.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **`shows` → `instruments`/`styles` migration** — existing `User.shows` data is lost on rename | Add a data migration step in the Prisma migration: copy `shows` values into `instruments`, set `styles` to `[]`. Alternatively keep `shows` as a deprecated alias and populate from it. |
| **Conflict detection correctness** — band member lookup adds latency to event save | Batch the member lookup with the conflict check in a single Prisma query using `include`. Accept minor added latency on event create/update. |
| **Musician view of events** — musician currently sees events by `musicianId` only; band events won't appear | Update `getAll` for musicians: query events where `musicianId = me OR bandId IN (bands I'm a member of)`. |
| **Event `mapEvent` function** — must be updated everywhere it appears | `mapEvent` is defined once in `events.ts` router; update there and it propagates. |
| **Min 2 members invariant** — `removeMember` could race and leave 1 member | Validate member count in `removeMember` procedure before deletion using a DB transaction. |

---

## Out of Scope

(From spec decisions)

- Per-event lineup variations (booking subset of band members)
- Band `hourlyRate` or cost estimates
- Cross-organization shared bands
- Public band/musician profile pages
- Notifications to band members on booking
- Musician availability calendar UI
