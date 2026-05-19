# Plan: Data Integrity — Schema & Session Alignment

**Feature:** `ensure-data-integrity`
**Date:** 2026-05-19
**Stack:** Next.js 15, tRPC, Prisma, Effector, Zod, NextAuth v5, vitest

---

## Architecture Overview

The user identity pipeline has three layers that must be kept in sync:

```
DB (Prisma User model)
  ↓  auth.ts / credentials authorize()
JWT token  (auth.config.ts jwt callback)
  ↓  auth.config.ts session callback
NextAuth Session  (types/next-auth.d.ts)
  ↓  shared/lib/session.ts sessionToUser()
User (entities/user/schema.ts → shared/types/index.ts)
  ↓  $user Effector store / UI / filter logic
```

Every field used on the client must pass through all four steps. Any gap = silent `undefined`.

**Key decisions (from spec):**
- `shows` is stale — rename everywhere to `instruments` (+ `styles`) to match the DB
- `UserSchema` is a strict mirror — add `organizationId`, `hotelId` now
- `organizationId` client fix is preventative; no active consumer, but fixes the type gap

**No DB migrations needed.** The Prisma schema already has the correct field names.

---

## Implementation Phases

### Phase 1 — Critical: Fix runtime crash in organizations router
**Goal:** Stop the Prisma `PrismaClientValidationError` on superadmin org detail view.

**Files:**
- `server/routers/organizations.ts:149`
  - Change `instrument: true` → `instruments: true` in the Musician select

---

### Phase 2 — UserSchema: add missing fields, retire `shows`
**Goal:** Make `UserSchema` a strict mirror of all identity-relevant DB fields.

**Files:**
- `entities/user/schema.ts`
  - Remove `shows: z.array(z.string()).optional()`
  - Add `instruments: z.array(z.string()).optional()`
  - Add `styles: z.array(z.string()).optional()`
  - Add `organizationId: z.string().optional()`
  - Add `hotelId: z.string().optional()`
  - `musicianId` already added in prior session — verify it's present

---

### Phase 3 — NextAuth types: rename `shows` → `instruments` + `styles`
**Goal:** Keep `types/next-auth.d.ts` aligned with the JWT/session shape.

**Files:**
- `types/next-auth.d.ts`
  - In `Session.user`: replace `shows: string[]` with `instruments: string[]` and `styles: string[]`
  - In `JWT`: same replacement

---

### Phase 4 — Auth layer: map real DB fields
**Goal:** Make the credentials authorize return and JWT callback read actual Prisma columns.

**Files:**
- `auth.ts` (credentials authorize return)
  - `shows: dbUser.shows` → `instruments: dbUser.instruments, styles: dbUser.styles`
- `auth.config.ts` (jwt callback)
  - The `u` cast type: `shows: string[]` → `instruments: string[], styles: string[]`
  - `token.shows = u.shows ?? []` → `token.instruments = u.instruments ?? [], token.styles = u.styles ?? []`
- `auth.config.ts` (session callback)
  - `session.user.shows = (token.shows as string[]) ?? []` → split into `instruments` and `styles`

---

### Phase 5 — `sessionToUser`: forward all fields + add return type guard
**Goal:** Ensure every field in `UserSchema` is forwarded from session, and TypeScript enforces it.

**Files:**
- `shared/lib/session.ts`
  - Add explicit return type `: User` to `sessionToUser()` — this is the compile-time guard
  - Replace `shows: sessionUser.shows ?? []` with:
    - `instruments: sessionUser.instruments ?? []`
    - `styles: sessionUser.styles ?? []`
  - Add `organizationId: sessionUser.organizationId ?? undefined`
  - Add `hotelId: sessionUser.hotelId ?? undefined`

---

### Phase 6 — Server routers: rename `shows`
**Goal:** Registration and admin user update write correct DB columns.

**Files:**
- `server/routers/auth.ts`
  - Line 43: `shows: input.shows ?? []` → `instruments: input.shows ?? []` (rename input field too; see Phase 8)
  - Line 66: `shows: dbUser.shows` → `instruments: dbUser.instruments, styles: dbUser.styles`
  - Line 146: same as line 66
- `server/routers/admin.ts`
  - Line 81: `shows: input.shows ?? []` → `instruments: input.instruments ?? [], styles: input.styles ?? []`
  - Line 95: `shows: dbUser.shows` → `instruments: dbUser.instruments, styles: dbUser.styles`

---

### Phase 7 — Auth feature model: rename `shows`
**Goal:** Keep local type interfaces in sync.

**Files:**
- `features/auth/model.ts`
  - Lines 16, 39: rename `shows?: string[]` → `instruments?: string[], styles?: string[]`

---

### Phase 8 — App pages: rename `shows`
**Goal:** UI reads and writes correct field names.

**Files:**
- `app/auth/register/page.tsx`
  - Form state: `shows: [] as string[]` → `instruments: [] as string[]`
  - Submit: `shows: formData.shows` → `instruments: formData.instruments`
  - Form field label/id: update from `shows` to `instruments`
- `app/(authenticated)/profile/page.tsx`
  - `user.shows?.join(", ")` → `user.instruments?.join(", ")`
  - Form state, label, input id: rename `shows` → `instruments`
- `app/org/[slug]/admin/musicians/[musicianId]/page.tsx`
  - `m.shows.join(", ")` → `m.instruments.join(", ")` (Musician entity, not User)
  - Form state, submit payload: rename `shows` → `instruments`

---

### Phase 9 — Fixtures: add identity fields, rename `shows`
**Goal:** Fixtures satisfy the updated `User` type and support identity-based filter tests.

**Files:**
- `specs/fixtures/users.ts`
  - Musician fixture:
    - Replace `shows: [...]` with `instruments: ["Jazz Trio", "Solo Piano", "Acoustic Set"]`
    - Add `musicianId: "seed-musician-1"`
  - Manager fixture:
    - Add `organizationId: "org-1"`
  - Hotel fixture:
    - Add `hotelId: "seed-hotel-1"` (if needed to satisfy strict type)
  - Remove `DEMO_PASSWORD` if it's not typed on `User` — or leave if unrelated

---

### Phase 10 — Tests and scenarios: rename `shows`
**Goal:** Test data matches the renamed fields; calendar filter test added.

**Files:**
- `specs/features/auth.scenarios.ts`
  - `shows: ["Jazz"]` → `instruments: ["Jazz"]`
- `__tests__/api/helpers.ts`
  - `shows: []` → `instruments: [], styles: []`
- `__tests__/api/musicians.test.ts`
  - `shows: ["Jazz"]` → `instruments: ["Jazz"]`
  - `shows: ["Rock"]` → `instruments: ["Rock"]`
  - `shows: []` → `instruments: []`
- `__tests__/features/events.test.ts` (or create `__tests__/features/calendar.test.ts`)
  - Add test: musician fixture (with `musicianId: "seed-musician-1"`) + event with `musicianId: "seed-musician-1"` → `filterEventsForCalendar` returns the event
  - Add test: musician fixture + event with different `musicianId` → returns empty

---

## Technical Dependencies

| Concern | Resolution |
|---|---|
| No DB migrations | `instruments`/`styles` already exist on both `User` and `Musician` Prisma models |
| NextAuth JWT shape | `shows` removed from JWT — existing active sessions will have stale `shows` key (harmless; `instruments` will be `undefined` until re-login, but `?? []` fallback handles it) |
| TypeScript enforcement | Adding `: User` return type to `sessionToUser` will surface any remaining gaps as compile errors |
| `pnpm test:run` | All field renames in test data must be done in Phase 10 before running |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Active sessions have stale JWT with `shows` key | Fields default to `[]` via `?? []` fallback — no crash, just empty until re-login |
| `shows` used in a file not caught in the audit | After all changes, run `grep -r "\.shows" --include="*.ts" --include="*.tsx"` to catch stragglers |
| Admin musician page reads from `Musician` entity (has `instruments`), not `User` | Handled in Phase 8 — that page uses `m.instruments`, not `user.instruments` |
| Fixture `satisfies Record<string, User>` will fail during transition | Update schema (Phase 2) before fixtures (Phase 9) — TypeScript will guide you |

---

## Change Order (dependency-safe)

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
```

Phases 1–5 must be done in order (types cascade downward). Phases 6–8 are independent of each other once Phase 5 is done. Phases 9–10 depend on Phase 2 (schema) being done first.

---

## Out of Scope

- UI redesign of register, profile, or musician admin forms
- New features consuming `organizationId` or `hotelId` on the client
- DB schema changes or migrations
- Changing JWT structure beyond field renames
- Adding `styles` to any UI form (rename only; `styles` field surfaces but no new UI for it)
