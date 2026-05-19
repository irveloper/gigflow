# Research: Data Integrity Audit

**Feature name:** `ensure-data-integrity`
**Date:** 2026-05-19
**Branch:** main

---

## Topic

Audit the codebase for schema drift, session mapping gaps, and wrong-ID comparisons — the same class of bugs that caused the musician calendar visibility bug (`event.musicianId === user.id` instead of `user.musicianId`).

---

## Codebase Findings

### Bug class: the original fix

The calendar bug had three layers:
1. `UserSchema` missing `musicianId` → field typed as `undefined`
2. `sessionToUser()` not mapping `musicianId` from session token
3. `filterEventsForCalendar` comparing `event.musicianId === user.id` (wrong ID)

All three layers must be correct for an identity-based filter to work. Any one gap silently produces empty results.

---

### Issue 1 — CRITICAL: Wrong field name in Prisma select (runtime error)

**File:** `server/routers/organizations.ts:149`

```ts
musician: { select: { id: true, name: true, instrument: true, isActive: true } }
```

`Musician` model has `instruments` (plural `String[]`), not `instrument`. Prisma will throw a `PrismaClientValidationError` at runtime when the `getOrgDetail` query runs. Affects superadmin org detail view.

**Fix:** rename `instrument` → `instruments`.

---

### Issue 2 — HIGH: `auth.ts` maps non-existent `dbUser.shows`

**Files:** `auth.ts:82`, `auth.config.ts` (jwt callback), `types/next-auth.d.ts`

```ts
// auth.ts line 82
shows: dbUser.shows,
```

`User` Prisma model has `instruments: String[]` and `styles: String[]` — no `shows` field. TypeScript accepts `dbUser.shows` because Prisma types infer it as `undefined` on a model that doesn't have the field, so no compile error. At runtime `shows` is always `undefined`, coerced to `[]` by the `?? []` fallback in `auth.config.ts`.

This means musician `shows` (used in the admin user form and `UserSchema`) is never persisted to or loaded from the DB. Any UI that displays `user.shows` shows an empty array.

**Root cause:** `shows` was a legacy field renamed to `instruments`/`styles` in the DB but not in the auth layer.

---

### Issue 3 — HIGH: `sessionToUser` missing `organizationId` and `hotelId`

**File:** `shared/lib/session.ts`

`sessionToUser()` currently maps:
- ✅ `musicianId` (just fixed)
- ✅ `organizationSlug`
- ❌ `organizationId` — present in JWT, session type, but not mapped
- ❌ `hotelId` — present in JWT, session type, but not mapped

Both fields are declared in `types/next-auth.d.ts` and populated in `auth.config.ts` jwt/session callbacks. On the server, `ctx.organizationId` comes directly from `session?.user?.organizationId` (trpc.ts:13), so server-side auth works. But any **client-side code** reading `$user.organizationId` or `$user.hotelId` gets `undefined`.

---

### Issue 4 — HIGH: `UserSchema` missing `organizationId` and `hotelId`

**File:** `entities/user/schema.ts`

`UserSchema` (the Zod source of truth for the `User` type) is missing:
- `organizationId: z.string().optional()`
- `hotelId: z.string().optional()`

Both exist in Prisma `User` model and NextAuth session type. Because `User = z.infer<typeof UserSchema>`, TypeScript will error on any code that tries to access `user.organizationId` or `user.hotelId` on a typed `User` object — forcing workarounds like `(user as any).organizationId`.

The schema currently has:
- `shows: z.array(z.string()).optional()` — maps to a non-existent DB field (see Issue 2)
- `hotel: z.string().optional()` — denormalized display name, not the FK `hotelId`

---

### Issue 5 — MEDIUM: Fixture data missing identity fields

**File:** `specs/fixtures/users.ts`

```ts
musician: {
  id: "user-1",
  // Missing: musicianId
  shows: ["Acoustic Set", "Jazz Trio", "Solo Piano"],
  ...
}
manager: {
  id: "user-2",
  // Missing: organizationId
  organizationSlug: "plugin-cancun",
  ...
}
```

- Musician fixture has no `musicianId` → `filterEventsForCalendar` will always return `[]` in tests using this fixture
- Manager fixture has no `organizationId` → any test that checks org scoping will silently pass with wrong data
- Both fixtures use `shows` field which maps to nothing in DB

---

### Issue 6 — LOW: `UserSchema` has `shows` but no `instruments`/`styles`

The schema models the domain with `shows` (a display concept) while the DB stores `instruments` and `styles` (separate arrays). There is no mapping layer converting between them. Neither the admin user form nor any API response populates `shows` from real data.

---

## Patterns for Preventing This Class of Bug

| Layer | Check |
|---|---|
| Prisma schema | Source of truth for DB shape |
| Zod entity schema | Must mirror all fields that client code uses |
| `sessionToUser()` | Must forward every field in `types/next-auth.d.ts` to `User` |
| Fixtures | Must include all identity FK fields (`musicianId`, `organizationId`) |
| Filter logic | Must use the right ID field (entity FK, not user PK) |

Currently there is no automated check between these layers. TypeScript catches some gaps but not all (e.g. `dbUser.shows` is `undefined`, not a type error).

---

## External References

- `prisma/schema.prisma` — canonical DB schema
- `types/next-auth.d.ts` — canonical session/JWT shape
- `entities/user/schema.ts` — canonical `User` Zod type
- `shared/lib/session.ts` — bridge: session → `User`
- `auth.ts` / `auth.config.ts` — bridge: DB → session/JWT

---

## Key Insights

1. **Three-layer bridge**: DB → JWT/session → `User` type. All three layers must be consistent. Any field used on the client must pass through all three.
2. **TypeScript doesn't catch all drift**: `dbUser.showsNonExistent` is `undefined` at runtime but may not error at compile time if Prisma types don't reject the access.
3. **Server vs client divergence**: Server routers use `ctx.session.user.*` directly (bypassing `UserSchema`), so server-side gaps don't surface. Client gaps only appear in UI.
4. **Identity FK fields are highest risk**: `musicianId`, `organizationId`, `hotelId` are used to scope queries/filters. A missing mapping = silent empty results or wrong data.

---

## Constraints & Risks

- Fixing `shows` → `instruments`/`styles` mapping requires a DB field name decision or an explicit mapping layer in auth. Could break existing UI that references `shows`.
- Adding `organizationId` / `hotelId` to `UserSchema` is safe but fixtures must be updated to avoid TS errors on `satisfies Record<string, User>`.
- The organizations router bug (Issue 1) is a runtime crash — highest urgency.

---

## Open Questions

1. Is `shows` intentionally different from `instruments`/`styles`? Or is it a leftover from a rename that was never cleaned up?
2. Should `UserSchema` be a strict mirror of the DB `User` model, or is it intentionally a subset?
3. Should we add a compile-time test (e.g. a type assertion) that `sessionToUser` output satisfies `UserSchema`?
4. Do we need `organizationId` on the client `User` type, or is it always accessed server-side via tRPC context?
