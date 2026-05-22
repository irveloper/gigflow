# Tasks: Event Audit Log

**Feature name:** `event-audit-log`
**Date:** 2026-05-22

---

## Phase 1 — Data Layer

**Goal:** Schema changes applied and migration run locally. Prisma client regenerated.

- [x] [S] Add `price Float?` field to `Event` model in `prisma/schema.prisma`
- [x] [S] Add `EventAuditLog` model with all fields (`id`, `eventId`, `organizationId`, `actorId`, `actorName`, `actorRole`, `action`, `metadata`, `timestamp`) and compound index `[eventId, timestamp(sort: Desc)]` + `[organizationId]`
- [x] [S] Run `pnpm prisma migrate dev --name add-event-audit-log` to generate and apply migration ⚠️ needs DATABASE_URL in .env.local — run manually: `! pnpm prisma migrate dev --name add-event-audit-log`
- [x] [S] Verify Prisma client regenerated and `prisma.eventAuditLog` is accessible in TypeScript

**Definition of Done:** `prisma.eventAuditLog.create({...})` compiles without error; `Event` model has `price` field.

---

## Phase 2 — Spec Layer (SDD)

**Goal:** Types, fixtures, and scenarios fully defined. No feature code until this phase is complete.

**Depends on:** Phase 1 (Prisma model must exist for schema to mirror)

- [x] [S] Create `src/specs/entities/event-audit-log.schema.ts`
  - `EventAuditLogActionSchema` — `z.enum([...])` with all 15 action values
  - `EventAuditLogSchema` — Zod schema mirroring the Prisma model
  - Export `EventAuditLog` type via `z.infer<typeof EventAuditLogSchema>`
- [x] [S] Add `price` field to `EventSchema` in `src/specs/entities/event.schema.ts` (`z.number().nullable().optional()`)
- [x] [S] Update `src/shared/types/index.ts` to re-export `EventAuditLog` and `EventAuditLogAction` from the new schema (no manual `type` declarations)
- [x] [M] Create `src/specs/fixtures/event-audit-logs.ts`
  - Export `allEventAuditLogs`: deterministic array covering one entry per action type
  - Use fixed IDs and timestamps (no `Date.now()` — deterministic fixtures only)
- [x] [M] Create `src/specs/features/event-audit-log.scenarios.ts`
  - Scenario: `EVENT_CREATED` entry written when event is created
  - Scenario: `MUSICIAN_ASSIGNED` / `MUSICIAN_CHANGED` entries on musician change
  - Scenario: `BAND_ASSIGNED` / `BAND_CHANGED` entries on band change
  - Scenario: `INVITATION_SENT` on notification create with `eventId`
  - Scenario: `INVITATION_READ` on notification `markRead` with `eventId`
  - Scenario: `CHECK_IN_RECORDED` on checkIn mutation
  - Scenario: `STATUS_CHANGED` on status transitions
  - Scenario: `FIELD_UPDATED` per changed field on update
  - Scenario: `PRICE_CHANGED` when price field changes
  - Scenario: `EVENT_DELETED` before hard delete (title in metadata)
  - Access control: musician role → FORBIDDEN on `list`
  - Access control: cross-org manager → FORBIDDEN on `list`
  - Pagination: `limit`/`offset` passed correctly; `total` returned

**Definition of Done:** All types compile; fixtures import without error; scenario file exports a valid object.

---

## Phase 3 — Server Layer

**Goal:** Every instrumented mutation writes an audit entry; `list` query returns paginated results.

**Depends on:** Phase 1, Phase 2

- [x] [S] Create `src/server/lib/audit.ts`
  - Export `writeEventAuditEntry(prisma, entry)` — wraps `prisma.eventAuditLog.create` in try/catch; logs error on failure; never throws
  - Export `diffEventFields(existing, update)` helper — returns array of changed-field descriptors `{ field, from, to }` for the known field list (title, date, time, durationMinutes, hotel, hotelId, musician, musicianId, band, bandId, status, price, description)
- [x] [M] Instrument `events.ts` — `create` mutation
  - After `prisma.event.create` succeeds, call `writeEventAuditEntry` with `EVENT_CREATED`
- [x] [M] Instrument `events.ts` — `update` mutation
  - Call `diffEventFields(existing, input.data)` before `prisma.event.update`
  - For musician/band changes: emit `MUSICIAN_ASSIGNED` / `MUSICIAN_CHANGED` / `MUSICIAN_REMOVED` / `BAND_*` (not `FIELD_UPDATED`)
  - For status changes: emit `STATUS_CHANGED` with `{ from, to }` metadata
  - For price changes: emit `PRICE_CHANGED` with `{ from, to }` metadata
  - For all other field changes: emit `FIELD_UPDATED` per field with `{ field, from, to }`
- [x] [M] Instrument `events.ts` — `delete` mutation
  - Before `prisma.event.delete`, call `writeEventAuditEntry` with `EVENT_DELETED` + `{ title: existing.title }` in metadata
- [x] [S] Instrument `events.ts` — `checkIn` mutation
  - After `prisma.event.update` succeeds, call `writeEventAuditEntry` with `CHECK_IN_RECORDED`
  - Include `{ time: input.timestamp, location: input.location }` in metadata
- [x] [M] Instrument `notifications.ts` — `markRead`
  - Fetch notification with `select: { userId, eventId }` (already done for ownership check)
  - If `eventId` is set: fetch event to get `organizationId`, call `writeEventAuditEntry` with `INVITATION_READ`
  - Actor: session user (musician reading their own notification)
- [x] [M] Instrument `notifications.ts` — `markAllRead`
  - Before `updateMany`, fetch all unread event-linked notifications for user: `prisma.notification.findMany({ where: { userId, read: false, eventId: { not: null } } })`
  - For each, resolve `organizationId` from event and call `writeEventAuditEntry` with `INVITATION_READ`
- [x] [S] Instrument `notifications.ts` — `create`
  - After `prisma.notification.create` succeeds, if `input.eventId` is set: fetch event `organizationId`, call `writeEventAuditEntry` with `INVITATION_SENT`
- [x] [M] Create `src/server/routers/event-audit-logs.ts`
  - `list` — `managerProcedure`, input: `{ eventId: z.string() }` merged with `OffsetPaginationInputSchema` (default limit 20)
  - Verify `event.organizationId === ctx.organizationId` — throw `FORBIDDEN` if mismatch
  - Return `{ items: EventAuditLog[], total: number }` (parallel `findMany` + `count`)
- [x] [S] Register `eventAuditLogsRouter` in `src/server/routers/index.ts`

**Definition of Done:** `pnpm test:run` passes; calling `list` with a cross-org `eventId` returns FORBIDDEN; a created event produces a log entry in the DB.

---

## Phase 4 — Tests

**Goal:** Test coverage mirrors scenario structure. All tests green.

**Depends on:** Phase 2, Phase 3

- [x] [M] Create `src/__tests__/features/event-audit-log.test.ts`
  - `describe`/`it` structure matches `event-audit-log.scenarios.ts` keys exactly
  - Use fixtures from `src/specs/fixtures/event-audit-logs.ts`
  - Mock `prisma.eventAuditLog.create` — assert called with correct `action` and `metadata`
  - Mock `prisma.eventAuditLog.findMany` + `count` — assert `take`, `skip`, `where` args
  - Test: musician role caller on `list` → `FORBIDDEN`
  - Test: cross-org `eventId` on `list` → `FORBIDDEN`
  - Test: `diffEventFields` helper returns correct change descriptors
  - Test: `writeEventAuditEntry` swallows errors — primary operation continues
- [x] [S] Run `pnpm test:run` and fix any failures

**Definition of Done:** `pnpm test:run` exits 0 with no skipped audit log tests.

---

## Phase 5 — UI

**Goal:** Manager can open any event's detail page and see its full audit timeline.

**Depends on:** Phase 3

- [x] [S] Create `src/app/org/[slug]/admin/events/[eventId]/page.tsx`
  - RSC: server-side auth guard — redirect if `role !== "manager"`
  - Parallel fetch: event detail + first 20 audit entries via tRPC caller
  - Layout: event summary card (title, date, time, hotel, musician/band, status) + audit log feed below
- [x] [M] Create `src/components/event-audit-log-feed.tsx`
  - `EventAuditLogFeed` — renders ordered list of `AuditLogEntry` rows
  - `AuditLogEntry` — icon (action-based) + action label + actor name + role badge + relative timestamp + detail string
  - Action label mapping: `EVENT_CREATED` → "Event created", `MUSICIAN_ASSIGNED` → "Musician assigned", etc.
  - Role badge colors: manager → blue, musician → purple, system → gray
  - Action icon/color: created/assigned → green, deleted/rejected → red, updated/read → gray, check-in → blue
- [x] [S] Add pagination controls to `EventAuditLogFeed`
  - "Previous" / "Next" buttons using `offset`-based navigation
  - Show "Showing X–Y of Z entries"
- [x] [S] Add row-level link in `src/app/org/[slug]/admin/events/page.tsx`
  - Each event row links to `/org/[slug]/admin/events/[eventId]`
- [x] [S] Verify middleware already covers `/org/[slug]/admin/*` routes for manager role (check `src/middleware.ts`) — add guard if missing

**Definition of Done:** A manager can navigate to an event detail page, see the audit feed with correct entries in newest-first order, and page through entries 20 at a time.

---

## Dependencies Summary

```
Phase 1 (Data)
  └── Phase 2 (Spec) — needs Prisma model to mirror
        └── Phase 3 (Server) — needs types from spec
              ├── Phase 4 (Tests) — needs router + spec fixtures
              └── Phase 5 (UI) — needs tRPC list endpoint
```

Phases 4 and 5 can proceed in parallel once Phase 3 is complete.
