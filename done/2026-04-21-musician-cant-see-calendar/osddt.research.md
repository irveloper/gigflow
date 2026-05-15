# Research: Why musician can't see events on calendar page

## Topic

Musician role logs in and sees zero events on the calendar page, even though events exist in fixtures assigned to that musician.

## Codebase Findings

### Filter logic (`entities/event/lib.ts:6`)

```ts
export const filterEventsForCalendar = (events: Event[], user: User | null) =>
  user?.role === "musician" ? events.filter((event) => event.musicianId === user.id) : events
```

Musicians only see events where `event.musicianId === user.id`. This is the correct design intent.

### Auth model — demo user IDs (`features/auth/model.ts:44-53`)

```ts
"musico@test.com": {
  id: "1",   // ← BUG: "1"
  ...
}
"gerente@test.com": { id: "2" }
"hotel@test.com":   { id: "3" }
```

### Fixture user IDs (`specs/fixtures/users.ts:6`)

```ts
musician: { id: "user-1", ... }
manager:  { id: "user-2", ... }
hotel:    { id: "user-3", ... }
```

### Fixture event musician IDs (`specs/fixtures/events.ts`)

```ts
todayAcoustic:  { musicianId: "user-1" }
todayJazz:      { musicianId: "user-1" }
tomorrowPiano:  { musicianId: "user-1" }
tomorrowVocal:  { musicianId: "user-4" }   // different musician
nextWeekGuitar: { musicianId: "user-5" }   // different musician
completedLatinJazz: { musicianId: "user-5" }
```

## Key Insights

### Root Bug: ID drift between `features/auth` demo users and `specs/fixtures`

| Source | Musician ID |
|---|---|
| `features/auth/model.ts` loginFx | `"1"` |
| `specs/fixtures/users.ts` | `"user-1"` |
| `specs/fixtures/events.ts` musicianId | `"user-1"` |

`filterEventsForCalendar` evaluates `"user-1" === "1"` → `false` for **every event**. The musician gets an empty calendar.

Same drift for manager (`"2"` vs `"user-2"`) and hotel (`"3"` vs `"user-3"`), but those roles don't have event filtering so the bug is invisible for them.

### Secondary: `registerFx` also generates random IDs not tied to fixtures

```ts
id: Math.random().toString(36).substr(2, 9)
```

Registered musicians will never match fixture event IDs, but that's expected since registered accounts are new users.

### The spec fixtures are the source of truth (per CLAUDE.md)

CLAUDE.md rule: "Effects that return mock data MUST import from `specs/fixtures/`". The `loginFx` demo users are effectively hardcoded mock data that drifted from `specs/fixtures/users.ts`.

## External References

- `specs/fixtures/users.ts` — canonical user IDs
- `specs/fixtures/events.ts` — canonical event-musician assignments
- `entities/event/lib.ts` — filter implementation
- `features/auth/model.ts` — loginFx demo user definitions

## Constraints & Risks

- Fix must be in `features/auth/model.ts` (align demo user IDs to fixture IDs), not in fixtures (fixtures are source of truth)
- The `auth-token` cookie and `localStorage` store the user object — existing sessions with old IDs (`"1"`, `"2"`, `"3"`) persist after a code fix. Users must log out and back in, or the fix can bump IDs in a way that invalidates stale sessions.
- No backend: all auth is client-side cookie + localStorage. No migration needed.
- `checkAuthFx` reads the stored JSON and calls `setUser` — so a stale stored user with `id: "1"` will still produce a broken session until re-login.

## Open Questions

1. Should `loginFx` import directly from `specs/fixtures/users.ts` to guarantee zero drift in the future?
2. Should `checkAuthFx` validate the stored user against known fixture IDs and clear stale data?
3. Do any tests assert on the hardcoded demo IDs `"1"`, `"2"`, `"3"`? (Need to check `__tests__/` before patching.)
