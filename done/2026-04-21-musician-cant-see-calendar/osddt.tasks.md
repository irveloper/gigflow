# Tasks: Musician calendar shows no events (ID drift bug)

## Phase 1 — Move Zod schemas into entities

- [x] [S] Create `entities/event/schema.ts` — copy from `specs/entities/event.schema.ts`
- [x] [S] Create `entities/user/schema.ts` — copy from `specs/entities/user.schema.ts`
- [x] [S] Create `entities/notification/schema.ts` — copy from `specs/entities/notification.schema.ts`
- [x] [S] Create `entities/musician/schema.ts` — copy from `specs/entities/musician.schema.ts`
- [x] [S] Create `entities/hotel/schema.ts` — copy from `specs/entities/hotel.schema.ts`
- [x] [S] Update `shared/types/index.ts` — re-export from `@/entities/*/schema` instead of `@/specs/entities/*`

**Definition of Done**: `pnpm tsc --noEmit` passes with no type errors. No file still imports from `@/specs/entities/`.

---

## Phase 2 — Create `shared/mocks/` and migrate fixture data

> Depends on: Phase 1 complete (schemas at new paths)

- [x] [S] Create `shared/mocks/users.ts` — migrate from `specs/fixtures/users.ts`, update type import to `@/entities/user/schema`
- [x] [S] Create `shared/mocks/events.ts` — migrate from `specs/fixtures/events.ts`, update type import to `@/entities/event/schema`
- [x] [S] Create `shared/mocks/notifications.ts` — migrate from `specs/fixtures/notifications.ts`
- [x] [S] Create `shared/mocks/musicians.ts` — migrate from `specs/fixtures/musicians.ts`
- [x] [S] Create `shared/mocks/hotels.ts` — migrate from `specs/fixtures/hotels.ts`
- [x] [S] Create `shared/mocks/index.ts` — barrel re-export all mocks

**Definition of Done**: All `shared/mocks/` files compile. `DEMO_PASSWORD` exported from `shared/mocks/users.ts`.

---

## Phase 3 — Fix the auth model (core bug fix)

> Depends on: Phase 2 complete (`shared/mocks/users.ts` exists)

- [x] [M] Update `features/auth/model.ts` `loginFx` — remove inline demo user objects, import `userFixtures` + `DEMO_PASSWORD` from `@/shared/mocks/users`, build `demoUsers` map from fixture objects
- [x] [M] Update `features/auth/model.ts` `checkAuthFx` — derive `VALID_DEMO_IDS` set from `Object.values(userFixtures).map(u => u.id)`, discard and clear session if stored ID not in set

**Definition of Done**: Demo musician login produces `user.id === "user-1"`. `filterEventsForCalendar` returns 3 events for that user. Stale session with `id: "1"` is cleared on `checkAuthFx` run.

---

## Phase 4 — Move scenario files to `__tests__/scenarios/`

> Depends on: Phase 2 complete (scenarios import from `shared/mocks/`)

- [x] [S] Create `__tests__/scenarios/calendar.scenarios.ts` — migrate from `specs/features/calendar.scenarios.ts`, update imports to `@/shared/mocks/*`
- [x] [S] Create `__tests__/scenarios/auth.scenarios.ts` — migrate from `specs/features/auth.scenarios.ts`
- [x] [S] Create `__tests__/scenarios/events.scenarios.ts` — migrate from `specs/features/events.scenarios.ts`
- [x] [S] Create `__tests__/scenarios/check-in.scenarios.ts` — migrate from `specs/features/check-in.scenarios.ts`
- [x] [S] Create `__tests__/scenarios/notifications.scenarios.ts` — migrate from `specs/features/notifications.scenarios.ts`
- [x] [S] Create `__tests__/scenarios/musicians.scenarios.ts` — migrate from `specs/features/musicians.scenarios.ts`
- [x] [S] Create `__tests__/scenarios/hotels.scenarios.ts` — migrate from `specs/features/hotels.scenarios.ts`
- [x] [S] Create `__tests__/scenarios/app-shell.scenarios.ts` — migrate from `specs/features/app-shell.scenarios.ts`

**Definition of Done**: All scenario files exist under `__tests__/scenarios/` and compile. No scenario file still imports from `@/specs/`.

---

## Phase 5 — Update test imports

> Depends on: Phases 2 and 4 complete

- [x] [S] Update `__tests__/features/auth.test.ts` — replace `@/specs/fixtures/users` with `@/shared/mocks/users`
- [x] [S] Update `__tests__/features/calendar.test.ts` — replace `@/specs/fixtures/*` with `@/shared/mocks/*`, replace `@/specs/features/calendar.scenarios` with `@/__tests__/scenarios/calendar.scenarios`
- [x] [S] Update `__tests__/entities/event-calendar.test.ts` — replace any `@/specs/*` imports
- [x] [S] Update `__tests__/entities/event-scheduling.test.ts` — replace any `@/specs/*` imports

**Definition of Done**: `pnpm test:run` passes with no import errors.

---

## Phase 6 — Delete `specs/`

> Depends on: All phases above complete, `pnpm test:run` green

- [x] [S] Delete `specs/` directory — `rm -rf specs/`
- [x] [S] Confirm no remaining `@/specs/` references anywhere in the codebase — `grep -r "@/specs" .`

**Definition of Done**: `specs/` directory does not exist. `grep -r "@/specs" .` returns no results.

---

## Phase 7 — Verify

- [x] [S] Run `pnpm test:run` — all tests pass
- [x] [M] Manual smoke test: login as `musico@test.com` → `/calendar` shows at least 3 events (today acoustic, today jazz, tomorrow piano)
- [x] [S] Manual smoke test: login as `gerente@test.com` → `/calendar` shows all events
- [x] [S] Manual smoke test: clear localStorage, set `user` key to `{"id":"1","role":"musician","email":"musico@test.com","name":"Carlos Mendoza","createdAt":"2026-01-01T00:00:00.000Z"}`, reload → session is discarded, redirected to login

**Definition of Done**: All acceptance criteria in `osddt.spec.md` satisfied.

---

## Dependencies Summary

```
Phase 1
  └─ Phase 2
       ├─ Phase 3 (auth fix — core bug)
       └─ Phase 4 (scenarios)
            └─ Phase 5 (test imports)
                 └─ Phase 6 (delete specs/)
                      └─ Phase 7 (verify)
```
