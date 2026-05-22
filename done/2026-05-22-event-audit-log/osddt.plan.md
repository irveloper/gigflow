# Plan: Event Audit Log

**Feature name:** `event-audit-log`
**Date:** 2026-05-22
**Stack:** Next.js App Router · Prisma · tRPC · Effector · shadcn/ui · Tailwind v4

---

## Architecture Overview

### Core pattern

Follow the existing `LoginAuditLog` model and `listLoginHistory` query in `admin.ts` exactly. The `EventAuditLog` table is append-only — only `create` and `findMany` operations are exposed; no `update` or `delete`.

### New Prisma model — `EventAuditLog`

```prisma
model EventAuditLog {
  id             String   @id @default(cuid())
  eventId        String                        // kept even after event deletion (orphan OK)
  organizationId String                        // denormalized for future cross-org queries
  actorId        String?                       // null = system action
  actorName      String                        // snapshot at time of action
  actorRole      String                        // "manager" | "musician" | "system"
  action         String                        // see action enum below
  metadata       Json?                         // { field, from, to } or domain-specific payload
  timestamp      DateTime @default(now())

  @@index([eventId, timestamp(sort: Desc)])
  @@index([organizationId])
}
```

**Action values (closed set):**
- `EVENT_CREATED`
- `MUSICIAN_ASSIGNED` / `MUSICIAN_CHANGED` / `MUSICIAN_REMOVED`
- `BAND_ASSIGNED` / `BAND_CHANGED` / `BAND_REMOVED`
- `INVITATION_SENT`
- `INVITATION_READ`
- `CHECK_IN_RECORDED`
- `CHECK_IN_CONFIRMED`
- `CHECK_IN_REJECTED`
- `STATUS_CHANGED`
- `FIELD_UPDATED` (one entry per changed field)
- `PRICE_CHANGED`
- `EVENT_DELETED`

### New `price` field on `Event`

```prisma
price Float? // null = no price set (default for existing rows)
```

### Instrumentation points

| File | Where | What to add |
|---|---|---|
| `server/routers/events.ts` | after `create` | `EVENT_CREATED` |
| `server/routers/events.ts` | after `update` | diff `existing` vs `data`, emit per-field entries |
| `server/routers/events.ts` | before `delete` | `EVENT_DELETED` (title snapshot in metadata) |
| `server/routers/events.ts` | after `checkIn` | `CHECK_IN_RECORDED` |
| `server/routers/events.ts` | after status → `cancelled`/`completed`/`scheduled` | `STATUS_CHANGED` / `CHECK_IN_CONFIRMED` / `CHECK_IN_REJECTED` |
| `server/routers/notifications.ts` | `markRead` — if `notification.eventId` not null | `INVITATION_READ` |
| `server/routers/notifications.ts` | `markAllRead` — filter event-linked rows | `INVITATION_READ` per event |
| `server/routers/notifications.ts` | `create` — if `eventId` present | `INVITATION_SENT` |

### Shared helper

`src/server/lib/audit.ts` — exports `writeEventAuditEntry(prisma, entry)` to keep router code clean and consistent. Routers call this after each successful mutation; the helper always wraps in try/catch so audit failures never break the primary operation.

### tRPC query

New router `eventAuditLogsRouter` (added to `src/server/routers/index.ts`):
- `list` — `managerProcedure`, input: `{ eventId, limit, offset }`, uses `OffsetPaginationInputSchema` pattern from `admin.ts`. Verifies `event.organizationId === ctx.organizationId` before querying log rows.

### UI

Route: `src/app/org/[slug]/admin/events/[eventId]/page.tsx`
- RSC fetches event detail + first page of audit entries
- Audit log rendered as a timeline/feed below event details (newest first)
- Pagination: "Load more" or page controls — 20 entries per page
- Each entry shows: relative timestamp, actor name + role badge, action label, detail string

---

## Implementation Phases

### Phase 1 — Data layer

**Goal:** Schema changes merged and migration run locally.

1. Add `price Float?` to `Event` model in `prisma/schema.prisma`
2. Add `EventAuditLog` model with all fields and indexes
3. Run `pnpm prisma migrate dev --name add-event-audit-log`
4. Regenerate Prisma client

**Files changed:**
- `prisma/schema.prisma`
- `prisma/migrations/…_add_event_audit_log/migration.sql` (auto-generated)

---

### Phase 2 — Spec layer (SDD)

**Goal:** Types, fixtures, and scenarios defined before any feature code.

1. Create `src/specs/entities/event-audit-log.schema.ts`
   - `EventAuditLogSchema` (Zod) — mirrors Prisma model
   - `EventAuditLogActionSchema` — `z.enum([...])` closed action set
   - Export inferred type via `z.infer<>`

2. Create `src/specs/fixtures/event-audit-logs.ts`
   - `allEventAuditLogs`: deterministic array of `EventAuditLog` fixtures covering each action type

3. Create `src/specs/features/event-audit-log.scenarios.ts`
   - Scenarios: entry written on create, musician assigned, check-in recorded, status changed, field updated, invitation read, event deleted
   - Access control: musician blocked, cross-org blocked
   - Pagination: 20-per-page

4. Update `src/shared/types/index.ts` to re-export `EventAuditLog` from schema (follow existing pattern — no manual `type` declarations)

**Files created:**
- `src/specs/entities/event-audit-log.schema.ts`
- `src/specs/fixtures/event-audit-logs.ts`
- `src/specs/features/event-audit-log.scenarios.ts`

---

### Phase 3 — Server layer

**Goal:** Audit entries written on every instrumented mutation; query endpoint available.

1. Create `src/server/lib/audit.ts`
   ```ts
   export async function writeEventAuditEntry(prisma, entry: {...}) {
     try {
       await prisma.eventAuditLog.create({ data: entry })
     } catch (e) {
       // log to console — never throw; audit must not block primary op
       console.error("[audit] failed to write entry", e)
     }
   }
   ```

2. Instrument `src/server/routers/events.ts`
   - `create`: call `writeEventAuditEntry` after `prisma.event.create` succeeds
   - `update`: compare `existing` vs `input.data` field-by-field; emit one `FIELD_UPDATED` or `MUSICIAN_ASSIGNED`/`BAND_ASSIGNED`/`STATUS_CHANGED`/`PRICE_CHANGED` entry per changed field
   - `delete`: fetch `existing` (already done), call `writeEventAuditEntry` with `EVENT_DELETED` + `{ title: existing.title }` in metadata, then delete
   - `checkIn`: call after `prisma.event.update` succeeds with `CHECK_IN_RECORDED`

3. Instrument `src/server/routers/notifications.ts`
   - `markRead`: after fetching notification, if `eventId` is set, call `writeEventAuditEntry` with `INVITATION_READ` — need to resolve `organizationId` from event
   - `markAllRead`: fetch all event-linked unread notifications for user, write one `INVITATION_READ` per `eventId`
   - `create`: if `input.eventId` is present, write `INVITATION_SENT`

4. Create `src/server/routers/event-audit-logs.ts`
   ```ts
   list: managerProcedure
     .input(z.object({ eventId: z.string(), ...OffsetPaginationInputSchema.shape }))
     .query(async ({ ctx, input }) => {
       // verify event belongs to org
       const event = await ctx.prisma.event.findUnique(...)
       if (!event || event.organizationId !== ctx.organizationId) throw FORBIDDEN
       const [items, total] = await Promise.all([
         ctx.prisma.eventAuditLog.findMany({
           where: { eventId: input.eventId },
           orderBy: { timestamp: "desc" },
           take: input.limit,
           skip: input.offset,
         }),
         ctx.prisma.eventAuditLog.count({ where: { eventId: input.eventId } }),
       ])
       return { items, total }
     })
   ```

5. Register router in `src/server/routers/index.ts`

**Files changed/created:**
- `src/server/lib/audit.ts` (new)
- `src/server/routers/events.ts`
- `src/server/routers/notifications.ts`
- `src/server/routers/event-audit-logs.ts` (new)
- `src/server/routers/index.ts`

---

### Phase 4 — Tests

**Goal:** Test coverage matching scenario structure.

1. Create `src/__tests__/features/event-audit-log.test.ts`
   - Mirror `src/specs/features/event-audit-log.scenarios.ts` describe/it structure
   - Use fixtures from `src/specs/fixtures/event-audit-logs.ts`
   - Mock `prisma.eventAuditLog.create` and `findMany` — assert correct args
   - Test access control: musician role → FORBIDDEN, cross-org → FORBIDDEN
   - Test pagination: correct `take`/`skip` passed, `total` returned

**Files created:**
- `src/__tests__/features/event-audit-log.test.ts`

---

### Phase 5 — UI

**Goal:** Managers can view the audit log from the event admin page.

1. Create `src/app/org/[slug]/admin/events/[eventId]/page.tsx`
   - RSC: fetch event detail + first 20 audit entries (parallel with `Promise.all`)
   - If `session.user.role !== "manager"` → redirect to 403 page
   - Layout: event summary card at top, audit log feed below

2. Create `src/components/event-audit-log.tsx` (or `src/widgets/event-audit-log/`)
   - `EventAuditLogFeed` — renders list of entries
   - `AuditLogEntry` — single row: icon + action label + actor + relative timestamp + detail
   - Pagination controls (prev/next or "load more")
   - Action → icon/color mapping (e.g. `EVENT_CREATED` → green, `CHECK_IN_REJECTED` → red, etc.)

3. Add link from existing `src/app/org/[slug]/admin/events/page.tsx` → event detail page (if no event detail page exists, this page IS the first one)

4. Ensure route is protected at middleware level — managers only

**Files created/changed:**
- `src/app/org/[slug]/admin/events/[eventId]/page.tsx` (new)
- `src/components/event-audit-log.tsx` (new)
- `src/app/org/[slug]/admin/events/page.tsx` (add row-level link)

---

## Technical Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Prisma | Already in use | Migration required |
| tRPC `managerProcedure` | Already exists | No changes needed |
| `OffsetPaginationInputSchema` | Already exists in `specs/entities/` | Reuse as-is |
| shadcn/ui `Table`, `Badge`, `Button` | Available | Use for audit feed |
| `next/navigation` redirect | Already used in admin pages | For role guard |
| Zod | Already in use | New schema only |

No new npm packages required.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Audit write failure breaks primary mutation | `writeEventAuditEntry` wraps in try/catch — logs error, never throws |
| `markAllRead` writes N audit entries in a loop | Batch fetch event-linked notifications first; write entries individually but inside the same request (acceptable for MVP — typical batch is small) |
| `INVITATION_SENT` is called from `notifications.create` which is `protectedProcedure` — actor is always the session user, but notifications may be created for musicians by a manager | Resolve `actorId` from `ctx.session.user` — this is correct since only managers can initiate event invitations |
| `price` field added to Event — existing tRPC `update` input may reject unknown fields | `EventSchema.partial()` drives the update input; add `price` to `EventSchema` in specs/entities first so it propagates everywhere |
| `update` diff logic is manual — risk of missing a field | Write a `diffEventFields()` helper that iterates a known field list; unit-test it separately |
| Cross-org audit access if manager switches org (edge case) | Always re-verify `event.organizationId === ctx.organizationId` inside the `list` query — never trust client-supplied `organizationId` |

---

## Out of Scope

- Real-time audit log updates (polling/SSE/websockets)
- Superadmin cross-org audit view (data model is ready; UI deferred)
- Audit log export (CSV/PDF)
- Log retention / pruning
- Audit log for musicians, hotels, users, bands (separate feature)
- Distinguishing org owner from all managers
- Org-level audit log page (log lives on event detail page only)
