# Tasks: Data Integrity — Schema & Session Alignment

**Feature:** `ensure-data-integrity`
**Date:** 2026-05-19

---

## Dependencies

```
Phase 1 → independent (critical fix, do first)
Phase 2 → must precede 3, 4, 5, 9
Phase 3 → must precede 4
Phase 4 → must precede 5
Phase 5 → must precede 6, 7, 8
Phases 6, 7, 8 → independent of each other, all depend on Phase 5
Phase 9 → depends on Phase 2
Phase 10 → depends on Phases 2 and 9
```

---

## Phase 1 — Fix runtime crash in organizations router

- [x] [S] In `server/routers/organizations.ts:149`, rename `instrument: true` → `instruments: true` in the Musician select

**Definition of done:** `pnpm test:run` passes and there is no Prisma validation error when the `getOrgDetail` query is invoked.

---

## Phase 2 — UserSchema: add missing fields, retire `shows`

- [x] [S] In `entities/user/schema.ts`, remove `shows: z.array(z.string()).optional()`
- [x] [S] In `entities/user/schema.ts`, add `instruments: z.array(z.string()).optional()`
- [x] [S] In `entities/user/schema.ts`, add `styles: z.array(z.string()).optional()`
- [x] [S] In `entities/user/schema.ts`, add `organizationId: z.string().optional()`
- [x] [S] In `entities/user/schema.ts`, add `hotelId: z.string().optional()`
- [x] [S] Verify `musicianId: z.string().optional()` is already present (added in prior session)

**Definition of done:** `User = z.infer<typeof UserSchema>` includes `instruments`, `styles`, `organizationId`, `hotelId`, `musicianId` and excludes `shows`. TypeScript errors appear in downstream files that still use `shows` — use these as a guide for subsequent phases.

---

## Phase 3 — NextAuth types: rename `shows`

- [x] [S] In `types/next-auth.d.ts`, in `Session.user`, replace `shows: string[]` with `instruments: string[]` and `styles: string[]`
- [x] [S] In `types/next-auth.d.ts`, in `JWT`, replace `shows: string[]` with `instruments: string[]` and `styles: string[]`

**Definition of done:** No TypeScript errors in `auth.config.ts` referencing `token.shows` or `session.user.shows`.

---

## Phase 4 — Auth layer: map real DB fields

- [x] [S] In `auth.ts` credentials authorize return, replace `shows: dbUser.shows` with `instruments: dbUser.instruments, styles: dbUser.styles`
- [x] [M] In `auth.config.ts` jwt callback:
  - Update the `u` cast type: replace `shows: string[]` with `instruments: string[], styles: string[]`
  - Replace `token.shows = u.shows ?? []` with `token.instruments = u.instruments ?? []` and `token.styles = u.styles ?? []`
- [x] [S] In `auth.config.ts` session callback, replace `session.user.shows = (token.shows as string[]) ?? []` with `session.user.instruments = (token.instruments as string[]) ?? []` and `session.user.styles = (token.styles as string[]) ?? []`

**Definition of done:** No TypeScript errors in `auth.ts` or `auth.config.ts`. DB fields `instruments` and `styles` (not `shows`) are read from `dbUser` and written to the JWT token.

---

## Phase 5 — `sessionToUser`: forward all fields + compile guard

- [x] [S] In `shared/lib/session.ts`, add explicit return type `: User` to `sessionToUser()`
- [x] [S] Replace `shows: sessionUser.shows ?? []` with `instruments: sessionUser.instruments ?? []` and `styles: sessionUser.styles ?? []`
- [x] [S] Add `organizationId: sessionUser.organizationId ?? undefined`
- [x] [S] Add `hotelId: sessionUser.hotelId ?? undefined`

**Definition of done:** `sessionToUser` has return type `: User`. TypeScript accepts the return value without cast. Any future missing field will produce a compile error here.

---

## Phase 6 — Server routers: rename `shows`

- [x] [M] In `server/routers/auth.ts`:
  - Line 43: `shows: input.shows ?? []` → `instruments: input.instruments ?? [], styles: input.styles ?? []` (aligns with register mutation input)
  - Line 66: `shows: dbUser.shows` → `instruments: dbUser.instruments, styles: dbUser.styles`
  - Line 146: same as line 66
- [x] [M] In `server/routers/admin.ts`:
  - Line 81: `shows: input.shows ?? []` → `instruments: input.instruments ?? [], styles: input.styles ?? []`
  - Line 95: `shows: dbUser.shows` → `instruments: dbUser.instruments, styles: dbUser.styles`

**Definition of done:** No TypeScript errors in routers. DB writes use `instruments`/`styles` columns.

---

## Phase 7 — Auth feature model: rename `shows`

- [x] [S] In `features/auth/model.ts`, rename `shows?: string[]` → `instruments?: string[], styles?: string[]` in both local interface declarations (lines 16, 39)

**Definition of done:** No TypeScript errors in `features/auth/model.ts`.

---

## Phase 8 — App pages: rename `shows`

- [x] [M] In `app/auth/register/page.tsx`:
  - Form state: `shows: [] as string[]` → `instruments: [] as string[]`
  - Submit: `shows: formData.shows` → `instruments: formData.instruments`
  - Form field label/id: update from `shows` to `instruments`
- [x] [M] In `app/(authenticated)/profile/page.tsx`:
  - `user.shows?.join(", ")` → `user.instruments?.join(", ")`
  - Form state, label, input id: rename `shows` → `instruments`
- [x] [M] In `app/org/[slug]/admin/musicians/[musicianId]/page.tsx`:
  - `m.shows.join(", ")` → `m.instruments.join(", ")` (Musician entity — already uses `instruments` in its schema)
  - Form state initial value, submit payload: rename `shows` → `instruments`

**Definition of done:** No TypeScript errors in any page file. Profile page displays musician instruments from the DB correctly.

---

## Phase 9 — Fixtures: add identity fields, rename `shows`

- [x] [S] In `specs/fixtures/users.ts`, musician fixture:
  - Replace `shows: [...]` with `instruments: ["Jazz Trio", "Solo Piano", "Acoustic Set"]`
  - Add `musicianId: "user-1"` (matches `musicianId` used in event fixtures)
- [x] [S] In `specs/fixtures/users.ts`, manager fixture:
  - Add `organizationId: "org-1"`
- [x] [S] In `specs/fixtures/users.ts`, hotel fixture:
  - Add `hotelId: "seed-hotel-1"`

**Definition of done:** `userFixtures` satisfies `Record<string, User>` with no TypeScript errors. Musician fixture has `musicianId`; manager fixture has `organizationId`.

---

## Phase 10 — Tests and scenarios: rename + add calendar filter test

- [x] [S] In `specs/features/auth.scenarios.ts`, rename `shows: ["Jazz"]` → `instruments: ["Jazz"]`
- [x] [S] In `__tests__/api/helpers.ts`, rename `shows: []` → `instruments: [], styles: []`
- [x] [S] In `__tests__/api/musicians.test.ts`, rename all `shows: [...]` → `instruments: [...]`
- [x] [M] Add calendar filter tests in `__tests__/features/events.test.ts`:
  - Test A: musician user (fixture with `musicianId: "user-1"`) + event with `musicianId: "user-1"` → `filterEventsForCalendar` returns that event
  - Test B: same musician + event with different `musicianId` → returns empty array
  - Test C: manager user → all events returned (no filter)
  - Test D: null user → all events returned (no filter)
- [x] [S] Verified no remaining `.shows` references in `.ts`/`.tsx` files
- [x] [S] `pnpm test:run` — 82/82 tests pass

**Definition of done:** `pnpm test:run` exits 0. No remaining `.shows` references in `.ts`/`.tsx` files outside of comments or the `working-on/` directory. Calendar filter tests pass.

---

## Completion Checklist

- [x] Phase 1 complete — org detail no longer crashes
- [x] Phases 2–5 complete — pipeline aligned, compile guard active
- [x] Phases 6–8 complete — all `shows` references renamed
- [x] Phase 9 complete — fixtures have identity FK fields
- [x] Phase 10 complete — `pnpm test:run` passes, calendar filter tested
