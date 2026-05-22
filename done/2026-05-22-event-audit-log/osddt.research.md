# Research: Event Audit Log

**Feature name:** `event-audit-log`
**Date:** 2026-05-22
**Branch:** `icaamal/feat-better-roles`

---

## Topic

Implement a per-event audit trail ("Event Audit Log") that records every change, action, and lifecycle event for a booking. Visible only to org managers (role = `manager`). Covers creation, musician assignment, notification reads/accepts, check-in, status transitions, price changes, and any field update.

---

## Codebase Findings

### Existing audit pattern — `LoginAuditLog`

`prisma/schema.prisma` (lines 289-300) already has a login audit table:

```prisma
model LoginAuditLog {
  id        String   @id @default(cuid())
  email     String
  userId    String?
  outcome   String   // "success" | "failure" | "locked"
  ipAddress String?
  userAgent String?
  timestamp DateTime @default(now())
}
```

This is the reference pattern for new audit tables — simple append-only record, no relations to entities needed (just IDs as strings for resilience).

### Event model (`prisma/schema.prisma` lines 244-274)

Key fields relevant to the log:
- `id`, `organizationId`, `title`, `description`, `date`, `time`, `durationMinutes`
- `hotelId`, `musicianId`, `bandId`
- `status` — enum: `scheduled | in-progress | completed | cancelled`
- `checkedIn`, `checkInTime`, `checkInPhoto`, `checkInLocation`, `checkInComments`
- No `price` field exists yet — must be added if price tracking is required

### Roles & procedure guards (`src/server/trpc.ts`)

| Procedure | Guard |
|---|---|
| `managerProcedure` | `role === "manager"` |
| `musicianProcedure` | `role === "musician"` |
| `hotelProcedure` | `role === "hotel"` |
| `orgProcedure` | valid `organizationId` + subscription check |
| `superAdminProcedure` | `role === "superadmin"` |

Audit log queries must use `managerProcedure` (or `orgProcedure`) — musicians and hotel role must be blocked.

No "owner" vs "manager" distinction exists currently. All managers in an org have admin access. Spec must decide whether to differentiate or keep all managers equal.

### Event mutations to instrument (`src/server/routers/events.ts`)

| Mutation | Line range | Who can call |
|---|---|---|
| `create` | 263-349 | `managerProcedure` |
| `update` | 351-404 | `managerProcedure` |
| `delete` | 406-420 | `managerProcedure` |
| `checkIn` | 426-466 | `protectedProcedure` (musician + manager) |

State-driven status changes in `src/features/events/model.ts`:
- `cancelEvent` → status `cancelled`
- `completeEvent` → status `completed` + `checkedIn=true`
- `confirmCheckIn` → status `completed`
- `rejectCheckIn` → status `scheduled`, clears check-in fields

These call tRPC mutations internally — audit hooks should fire in the router, not the Effector model.

### Notification model (`prisma/schema.prisma` lines 302-316)

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  title     String
  message   String
  type      String
  read      Boolean  @default(false)
  timestamp DateTime @default(now())
  actionUrl String?
  actionText String?
  eventId   String?
}
```

`read` flag and `eventId` link are the relevant fields. When a musician marks a notification read (and it has an `eventId`), that should produce an audit entry.

### Admin pages structure (`src/app/org/[slug]/admin/`)

Existing admin pages: `users`, `musicians`, `hotels`, `bands`, `events`. No audit log page. Pattern to follow: RSC page → tRPC query → table UI.

### Session shape (`src/auth.ts` lines 74-92)

```typescript
{ id, name, email, role, isActive, emailVerified,
  phone, instruments, styles, hourlyRate, location, contactPerson,
  hotelId, organizationId, organizationSlug, musicianId }
```

`session.user.role` and `session.user.organizationId` are available in every tRPC procedure — sufficient for both guard and org scoping.

---

## External References

- Prisma append-only pattern: no `update`/`delete` on audit table, only `create` + `findMany`
- Domain-Driven Design "Domain Event" naming: `EventCreated`, `MusicianAssigned`, `CheckInRecorded`, etc. → maps cleanly to `action` string field
- OWASP audit log best practices: store actor ID, timestamp, before/after state where relevant

---

## Key Insights

1. **Follow `LoginAuditLog` pattern** — simple model, append-only, no cascading deletes. Store actor `userId`, `eventId`, `action`, `metadata` (JSON), `timestamp`.

2. **`action` enum approach** — define a closed set of action types (e.g. `EVENT_CREATED`, `MUSICIAN_ASSIGNED`, `NOTIFICATION_READ`, `CHECK_IN_RECORDED`, `STATUS_CHANGED`, `FIELD_UPDATED`, `EVENT_DELETED`) so the UI can render readable labels and filter by type.

3. **Instrument at the router layer** — after each successful mutation in `events.ts` (and `notifications.ts` for read events), call `prisma.eventAuditLog.create(...)`. Do not add audit logic to Effector models.

4. **`metadata` JSON column** — store the diff or relevant payload (e.g. `{ from: "scheduled", to: "cancelled" }` for status change; `{ musicianId: "..." }` for assignment). Keeps the main model narrow.

5. **No `price` field today** — if price tracking is in scope, add a `price` field to the `Event` model in the same migration and include it in `FIELD_UPDATED` metadata.

6. **Access control** — `managerProcedure` is the right guard. Org scoping: always filter by `organizationId` from session, never trust client-supplied org ID.

7. **UI placement** — `/org/[slug]/admin/events/[eventId]/audit` or a side-panel/drawer on the event detail page. Chronological list, newest first.

---

## Constraints & Risks

- **No migration rollback** — once deployed, audit log rows accumulate. No delete. Need to decide retention policy (out of scope for MVP).
- **`EVENT_DELETED` paradox** — if we hard-delete events (current pattern), the log row references a deleted `eventId`. Options: (a) store event title/snapshot in metadata, (b) soft-delete events, (c) accept orphaned rows (OK if we store snapshot).
- **Notification read instrumentation** — `markAsRead` in `notifications.ts` must be hooked; currently it may batch-mark all notifications. Need to filter only event-linked ones.
- **No price field** — adding it requires a new migration and seeding existing events with `null`/`0`.
- **Performance** — high-volume orgs could accumulate thousands of log rows per event. Index on `(eventId, timestamp DESC)` is mandatory.
- **Superadmin view** — should superadmin see all org audit logs? Current research doesn't show a cross-org event view. Defer to spec.

---

## Open Questions

1. **Owner vs all managers** — should the audit log be visible to ALL managers in the org, or only the org creator/"owner"? (Currently no owner distinction exists.)
2. **Price field** — is adding a `price` field to Event in scope for this feature, or deferred?
3. **`EVENT_DELETED` handling** — soft delete or snapshot in metadata?
4. **Notification instrumentation scope** — track only "musician read notification linked to event" or also "notification sent to musician"?
5. **Retention/pagination** — how far back should the log go? Paginated or full list?
6. **Band assignment** — should band selection be tracked the same as musician assignment?
7. **Superadmin access** — can superadmin view audit logs across all orgs?
8. **Real-time updates** — should the audit log page update live (polling/SSE) or only on page refresh?
