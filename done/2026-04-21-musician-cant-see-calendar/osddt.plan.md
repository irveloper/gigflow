# Plan: Musician calendar shows no events (ID drift bug)

## Architecture Overview

The fix has two concerns that must be addressed together:

1. **Data layer consolidation**: eliminate `specs/` as a directory. Zod schemas belong in `entities/*/schema.ts` (each entity owns its schema). Mock/fixture data belongs in `shared/mocks/` (FSD-compliant, single source of truth). Scenario files (currently `specs/features/`) move to `__tests__/scenarios/` since they are test infrastructure.

2. **ID drift bug**: `features/auth/model.ts` defines demo users with IDs `"1"/"2"/"3"` while mock event data uses `"user-1"/"user-2"/"user-3"`. After the data layer consolidation, `loginFx` imports demo users directly from `shared/mocks/users.ts` — drift is structurally impossible.

`shared/types/index.ts` re-exports from `entities/*/schema.ts` instead of `specs/entities/` — the public type surface is unchanged so no feature code needs updating beyond the auth model and test imports.

---

## Implementation Phases

### Phase 1 — Move Zod schemas into entities

For each entity, create a `schema.ts` file in its entity folder. Copy content verbatim from `specs/entities/`.

| Source | Destination |
|---|---|
| `specs/entities/event.schema.ts` | `entities/event/schema.ts` |
| `specs/entities/user.schema.ts` | `entities/user/schema.ts` |
| `specs/entities/notification.schema.ts` | `entities/notification/schema.ts` |
| `specs/entities/musician.schema.ts` | `entities/musician/schema.ts` |
| `specs/entities/hotel.schema.ts` | `entities/hotel/schema.ts` |

Update `shared/types/index.ts` to re-export from the new paths:
```ts
// before
export type { User, ... } from "@/specs/entities/user.schema"
// after
export type { User, ... } from "@/entities/user/schema"
```

No other code changes needed in Phase 1 — everything upstream already imports from `@/shared/types`.

---

### Phase 2 — Create `shared/mocks/` and migrate fixture data

Create `shared/mocks/` with one file per entity. Content comes from `specs/fixtures/` — same data, same exports, same `satisfies` constraints, updated import paths (Zod types from `@/entities/*/schema` instead of `@/specs/entities/`).

| Source | Destination |
|---|---|
| `specs/fixtures/users.ts` | `shared/mocks/users.ts` |
| `specs/fixtures/events.ts` | `shared/mocks/events.ts` |
| `specs/fixtures/notifications.ts` | `shared/mocks/notifications.ts` |
| `specs/fixtures/musicians.ts` | `shared/mocks/musicians.ts` |
| `specs/fixtures/hotels.ts` | `shared/mocks/hotels.ts` |

Create `shared/mocks/index.ts` that barrel-re-exports all mocks.

---

### Phase 3 — Fix the auth model (core bug fix)

**File: `features/auth/model.ts`**

Replace the inline demo user objects in `loginFx` with an import from `shared/mocks/users.ts`:

```ts
import { userFixtures, DEMO_PASSWORD } from "@/shared/mocks/users"

// In loginFx:
const demoUsers: Record<string, User> = {
  [userFixtures.musician.email]: userFixtures.musician,
  [userFixtures.manager.email]:  userFixtures.manager,
  [userFixtures.hotel.email]:    userFixtures.hotel,
}

const user = demoUsers[email]
if (!user || password !== DEMO_PASSWORD) {
  throw new Error("Credenciales invalidas")
}
```

This makes ID drift structurally impossible — `loginFx` and event fixtures share the same source objects.

**Add stale session validation to `checkAuthFx`:**

```ts
import { userFixtures } from "@/shared/mocks/users"

const VALID_DEMO_IDS = new Set(
  Object.values(userFixtures).map((u) => u.id)
)

// In checkAuthFx, after parsing stored user:
if (!VALID_DEMO_IDS.has(user.id)) {
  localStorage.removeItem("user")
  clearAuthCookie()
  return null
}
```

This auto-discards any session persisted with the old IDs (`"1"`, `"2"`, `"3"`).

---

### Phase 4 — Move scenario files to `__tests__/scenarios/`

Scenario files are test infrastructure. They reference mock data, not app code.

| Source | Destination |
|---|---|
| `specs/features/calendar.scenarios.ts` | `__tests__/scenarios/calendar.scenarios.ts` |
| `specs/features/auth.scenarios.ts` | `__tests__/scenarios/auth.scenarios.ts` |
| `specs/features/events.scenarios.ts` | `__tests__/scenarios/events.scenarios.ts` |
| `specs/features/check-in.scenarios.ts` | `__tests__/scenarios/check-in.scenarios.ts` |
| `specs/features/notifications.scenarios.ts` | `__tests__/scenarios/notifications.scenarios.ts` |
| `specs/features/musicians.scenarios.ts` | `__tests__/scenarios/musicians.scenarios.ts` |
| `specs/features/hotels.scenarios.ts` | `__tests__/scenarios/hotels.scenarios.ts` |
| `specs/features/app-shell.scenarios.ts` | `__tests__/scenarios/app-shell.scenarios.ts` |

Update internal imports in each scenario file: `@/specs/fixtures/*` → `@/shared/mocks/*`.

---

### Phase 5 — Update test imports

Four test files reference `@/specs/`:

| File | Old import | New import |
|---|---|---|
| `__tests__/features/auth.test.ts` | `@/specs/fixtures/users` | `@/shared/mocks/users` |
| `__tests__/features/calendar.test.ts` | `@/specs/fixtures/events`, `@/specs/fixtures/users`, `@/specs/features/calendar.scenarios` | `@/shared/mocks/events`, `@/shared/mocks/users`, `@/__tests__/scenarios/calendar.scenarios` |
| `__tests__/entities/event-calendar.test.ts` | any `@/specs/*` | updated paths |
| `__tests__/entities/event-scheduling.test.ts` | any `@/specs/*` | updated paths |

---

### Phase 6 — Delete `specs/`

After all imports are updated and tests pass, remove the `specs/` directory entirely.

```
rm -rf specs/
```

---

### Phase 7 — Verify

Run the full test suite:

```
pnpm test:run
```

All tests must pass. Manually verify:
1. Login as `musico@test.com` → calendar shows today's acoustic + jazz events and tomorrow's piano event
2. Login as `gerente@test.com` → calendar shows all events
3. Open browser with stale session (id `"1"`) → session is cleared, login page shown

---

## Technical Dependencies

- **Effector** (`effector`, `effector-react`) — no changes to reactive model shape
- **Zod** — schemas move paths, no schema changes
- **FullCalendar** — unchanged
- **Vitest + effector scope (`fork`)** — tests already use forked scopes; no runner changes needed

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `tsconfig.json` path aliases may not resolve `@/entities/*/schema` if not covered by `@/entities/*` alias | Check `tsconfig.json` paths before Phase 1; the existing `@/entities/*` alias should cover it |
| Circular import: `shared/mocks/` imports from `@/entities/*/schema`, entities import from `@/shared/types` | No cycle — `shared/mocks/` imports Zod schemas directly from `entities/`, not via `shared/types`; `shared/types` re-exports from `entities/` only |
| `DEMO_PASSWORD` constant currently exported from `specs/fixtures/users.ts` — tests import it | Move `DEMO_PASSWORD` to `shared/mocks/users.ts` and update test imports |
| Stale session validation whitelist must stay in sync with fixture user IDs | Derived at runtime from `Object.values(userFixtures)` — no manual list to maintain |

---

## Out of Scope

- Changing the calendar filter logic (`filterEventsForCalendar` is correct)
- Changing event fixture data or musician assignments
- Adding real backend authentication or a database
- Fixing registered (non-demo) musician accounts — they have no fixture events by design
- Modifying `registerFx` — random IDs for new users are expected
