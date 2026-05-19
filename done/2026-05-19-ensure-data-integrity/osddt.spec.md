# Spec: Data Integrity — Schema & Session Alignment

**Feature name:** `ensure-data-integrity`
**Date:** 2026-05-19

---

## Overview

A class of silent data bugs exists in the three-layer pipeline that moves user identity fields from the database to the client:

```
DB (Prisma) → JWT/Session (NextAuth) → User type (Zod) → UI / filter logic
```

Any gap in this pipeline causes a field to silently appear as `undefined` on the client — which produces empty lists, invisible events, or inaccessible features for the affected user role. The bugs are hard to detect because TypeScript does not always catch the mismatch, and the failure mode is silent (no error, just missing data).

This work fixes all known gaps in the pipeline and introduces a structural safeguard to prevent recurrence.

---

## Session Context

This spec was triggered by a live bug: musicians could not see their own events in the calendar. The filter compared the event's `musicianId` against the user's auth `id` (which is different), so no events ever matched. Fixing it required three coordinated changes: adding `musicianId` to `UserSchema`, forwarding it in `sessionToUser()`, and correcting the filter comparison.

The audit that followed found five additional gaps of the same class. This spec covers all of them.

---

## Research Summary

The audit identified six confirmed issues across the pipeline (see `osddt.research.md`):

1. **Runtime crash** — `organizations.ts` selects a non-existent field `instrument` from the Musician model (should be `instruments`).
2. **Silent data loss** — `auth.ts` reads `dbUser.shows`, a field that does not exist in the DB (renamed to `instruments`/`styles`). Musicians always see an empty list of shows.
3. **Client field unavailable** — `sessionToUser()` does not forward `organizationId` or `hotelId` from the session token to the `User` object.
4. **Type gap** — `UserSchema` does not declare `organizationId` or `hotelId`, so TypeScript rejects any client code that tries to read them.
5. **Broken test fixtures** — The musician fixture is missing `musicianId` and the manager fixture is missing `organizationId`, making any tests that rely on identity-based filtering unreliable.
6. **Domain naming mismatch** — `shows` (domain concept) is used in schema and fixtures but the DB stores `instruments` and `styles`.

---

## Requirements

### Must have

1. **Org detail page works for superadmins** — viewing an organization's detail must not crash. The musician list within that view must load correctly.

2. **Musician users see their shows/instruments in their profile** — the list of instruments (and optionally styles) a musician has on record in the DB must be visible in the UI. It must not always appear empty.

3. **Client `User` object includes `organizationId` and `hotelId`** — any component or feature that reads these fields from the logged-in user must receive the correct value, not `undefined`.

4. **Identity FK fields are typed on `User`** — `organizationId`, `hotelId`, and `musicianId` must be part of the canonical `User` type so TypeScript enforces their presence and usage.

5. **Test fixtures reflect real identity** — the musician fixture must include a `musicianId` value; the manager fixture must include an `organizationId` value. Tests that use these fixtures to exercise identity-based filtering must produce correct results.

6. **`filterEventsForCalendar` remains correct** — musicians must see only their own events. The fix applied in the prior session must be preserved and covered by a fixture-driven test.

### Should have

7. **Compile-time guard on `sessionToUser`** — the return type of `sessionToUser()` should be checked against `User` (via `satisfies` or an explicit return type annotation) so that missing field mappings produce a TypeScript error, not a silent runtime gap.

8. **`instruments` and `styles` available on `User`** — if `shows` is retired as a field name, `instruments` and `styles` from the DB should be surfaced through the pipeline with correct field names, so the admin user form and any musician profile UI can display them.

---

## Scope

### In scope

- Fix the runtime-crashing Prisma field name typo (`instrument` → `instruments`) in the organizations router
- Align `auth.ts` field mappings so they read real DB fields
- Add missing fields to `UserSchema` (`organizationId`, `hotelId`)
- Forward missing fields in `sessionToUser()` (`organizationId`, `hotelId`)
- Update user fixtures to include identity FK fields (`musicianId`, `organizationId`)
- Decide on `shows` vs `instruments`/`styles` and apply consistently across schema, auth layer, and fixtures
- Add a compile-time check that `sessionToUser` output satisfies `UserSchema`

### Out of scope

- UI redesign of the musician profile or admin user form
- Any new feature that uses `organizationId` or `hotelId` on the client (fixing the pipeline is in scope; building new consumers is not)
- Changes to the DB schema (no new migrations)
- Changing the NextAuth JWT structure or session callbacks beyond what is needed to fix the field naming

---

## Acceptance Criteria

1. **Org detail does not crash** — a superadmin can open the organization detail page without a Prisma validation error.

2. **Musician's instruments are not empty** — after login, a musician user's profile data includes a non-empty `instruments` (or `shows`) list if one is stored in the DB.

3. **`user.organizationId` is defined on the client** — after login as a manager or hotel user, client-side code reading `$user.organizationId` receives the correct string, not `undefined`.

4. **`user.hotelId` is defined on the client** — after login as a hotel user, client-side code reading `$user.hotelId` receives the correct string, not `undefined`.

5. **TypeScript accepts `user.organizationId` and `user.hotelId`** — no type-cast (`as any`) is needed to access these fields on a value typed as `User`.

6. **Musician fixture has `musicianId`** — the fixture satisfies `User` type with a `musicianId` field.

7. **Manager fixture has `organizationId`** — the fixture satisfies `User` type with an `organizationId` field.

8. **Calendar filter test passes with correct fixture** — a unit test using the musician fixture and a matching event (same `musicianId`) confirms that `filterEventsForCalendar` returns that event for the musician user.

9. **`sessionToUser` type-checks without cast** — the function signature or a `satisfies` assertion makes TypeScript enforce that all fields in `UserSchema` are forwarded.

10. **All existing tests pass** — no regression in `pnpm test:run`.

---

## Decisions

1. **`shows` vs `instruments`/`styles`**: `shows` is stale — rename to `instruments` (and `styles`) everywhere to match the DB. No mapping layer needed.

2. **`UserSchema` completeness policy**: Strict mirror. Add all identity FK fields (`organizationId`, `hotelId`) now. Future DB additions must be reflected here too.

3. **`organizationId` on client**: No active client consumer found. Fix is preventative — aligns the type with the strict-mirror policy and prevents future silent bugs.
