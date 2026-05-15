# Spec: Musician calendar shows no events (ID drift bug)

## Overview

When a user logs in with the demo musician account (`musico@test.com`), the calendar page displays zero events despite fixture data containing events explicitly assigned to that musician. The bug is a data consistency failure: the demo login function produces a user with `id: "1"` while all fixture events reference that musician as `musicianId: "user-1"`. The role-based event filter discards every event because no ID matches.

The fix must ensure that demo login credentials produce user objects whose IDs are consistent with the fixture event data, so that the musician calendar filter works as intended.

## Research Summary

Research identified the precise root cause:

- `features/auth/model.ts` loginFx hardcodes musician `id: "1"`, manager `id: "2"`, hotel `id: "3"`
- Canonical mock data (to live in `shared/mocks/`) defines musician `id: "user-1"`, manager `id: "user-2"`, hotel `id: "user-3"`
- Event mock data assigns events using `musicianId: "user-1"`
- The calendar filter `event.musicianId === user.id` evaluates `"user-1" === "1"` → `false` for all events
- Stale sessions in `localStorage`/cookie with old IDs persist until discarded — auto-discard required
- `specs/` directory to be eliminated; Zod schemas move to `entities/*/schema.ts`, mock data to `shared/mocks/`

## Requirements

1. After logging in as the demo musician (`musico@test.com`), the user must see all events assigned to that musician on the calendar page (today, upcoming, and past events within the visible range).
2. The calendar's role-based filter must correctly match events to the authenticated musician's identity.
3. Demo login credentials must produce user objects that are identical in structure and ID values to the canonical mock users in `shared/mocks/users.ts`.
4. The fix must not alter how the calendar displays events for manager or hotel roles (they see all events regardless of ID).
5. Stale sessions stored from before the fix must not silently produce a broken calendar — the system should either clear them or re-validate them on load.

## Scope

**In scope:**
- Migrating Zod schemas from `specs/entities/` → `entities/*/schema.ts`
- Migrating mock data from `specs/fixtures/` → `shared/mocks/`
- Removing the `specs/` directory
- Aligning demo user IDs in `loginFx` to import from `shared/mocks/users.ts`
- Auto-discarding stale localStorage/cookie sessions with old IDs in `checkAuthFx`
- Verifying that the calendar filter works correctly after re-login

**Out of scope:**
- Changing how the calendar filter works (filter logic is correct)
- Changing fixture event data (fixtures are source of truth)
- Adding real backend authentication
- Fixing registered (non-demo) musician accounts — they have no fixture events by design

## Acceptance Criteria

1. **Demo musician login → events visible**: logging in as `musico@test.com` and navigating to `/calendar` shows at least the events for today and tomorrow that are assigned to Carlos Mendoza.
2. **Manager and hotel unaffected**: logging in as `gerente@test.com` or `hotel@test.com` still shows all events on the calendar.
3. **Stale session handled**: a user whose browser holds an old session with `id: "1"` either sees a cleared session on reload (forcing re-login) or the session is automatically upgraded to the correct ID.
4. **Mock parity**: the user object produced by demo login is structurally identical to the corresponding entry in `shared/mocks/users.ts` (same `id`, `email`, `name`, `role`, and role-specific fields).
5. **No regressions in tests**: existing test suite passes after the change.

## Decisions

1. **Stale session handling**: auto-discard stale sessions. `checkAuthFx` must validate the stored user ID against known demo IDs and clear `localStorage`/cookie if no match is found — no reliance on manual logout.
2. **Mock data location**: eliminate `specs/` entirely. Zod schemas move to `entities/*/schema.ts`. All mock/fixture data moves to `shared/mocks/` (single source of truth). `loginFx` imports demo users from `shared/mocks/users.ts` — no inline copies, no drift possible.
