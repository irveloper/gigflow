# Research: SaaS Organization Multi-Tenancy

**Feature name:** `saas-org-multitenancy`
**Branch:** `main`
**Date:** 2026-05-15

---

## Topic

Add an `Organization` entity as the root tenant in a SaaS model. Each org owns its Hotels and Managers. Musicians have a many-to-many relationship with Organizations (can work across orgs). Hotels may also relate to multiple orgs. All data queries must be org-scoped.

---

## Codebase Findings

### Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js App Router | 16.2.4 |
| ORM | Prisma + `@prisma/adapter-pg` | 7.8.0 |
| Auth | NextAuth v5 (JWT sessions) | 5.0.0-beta.31 |
| API | tRPC v11 over Route Handlers | 11.17.0 |
| Validation | Zod | 4.3.6 |
| State | Effector | 23.4.4 |
| DB | PostgreSQL 16 | — |
| Storage | AWS S3 (check-in photos) | — |

### Current Data Model (Prisma)

**User**
```
id, name, email, emailVerified, image, password, role (musician|manager|hotel|null),
isActive, phone, shows[], hourlyRate, location, contactPerson, hotelId, createdAt
```
- `role` is global — no org scope
- `hotelId` → one-to-one Hotel relation (hotel staff only)
- No `organizationId` field

**Hotel**
```
id, name, email, phone, location, contactPerson, isActive, avatar, createdAt
```
- Relations: `events`, `users`
- No `organizationId`

**Musician**
```
id, name, email, phone, shows[], hourlyRate, isActive, avatar, createdAt
```
- Relations: `events[]`
- Standalone — no org link, no User relation

**Event**
```
id, title, description, date, time, durationMinutes, hotel (string), hotelId,
musician (string), musicianId, status, checkedIn, checkInTime, checkInPhoto,
checkInLocation, checkInComments, createdAt
```
- 1:1 hotel, 1:1 musician — no org scope, no many-to-many

**Notification** — linked to User and optionally Event. No org scope.

**NextAuth models:** Account, Session, VerificationToken (standard).

### Auth System

- `auth.ts` — NextAuth credentials provider (email + bcrypt)
- `/types/next-auth.d.ts` — session extends with: `id, role, isActive, phone, shows, hourlyRate, location, contactPerson, hotelId`
- JWT callbacks populate all User fields into token → session
- Role guards in tRPC: `managerProcedure`, `musicianProcedure`, `hotelProcedure`
- No org-scoped guard exists

### tRPC Routers (`/server/routers/`)

- `auth.ts` — register, me
- `admin.ts` — listUsers, createUser, deactivateUser (manager-only)
- `events.ts` — CRUD + checkIn
- `hotels.ts` — CRUD
- `musicians.ts` — CRUD
- `notifications.ts` — getAll, markRead, markAllRead

All CRUD operations are global — no org filtering on any query.

### FSD Structure

```
specs/entities/    ← Zod schemas (source of truth)
specs/fixtures/    ← deterministic mock data
specs/features/    ← vitest scenario tests
entities/*/        ← schema.ts + model.ts (Effector store) + index.ts
features/*/        ← model.ts (Effector effects + stores)
widgets/           ← admin tables, calendar, check-in, navigation
shared/types/      ← re-exports Zod-inferred types
app/(authenticated)/ ← protected routes
app/api/trpc/      ← tRPC endpoint
middleware.ts      ← rate limiting + route protection
```

### Fixtures (`/specs/fixtures/`)

Demo users: musician (Carlos Mendoza), manager (Ana Garcia), hotel (Hotel Paradisus) — no org field.
Hotels: 4 (Paradisus, Moon Palace, Xcaret, Iberostar) — standalone.
Events: 8 — mix of statuses.

### Existing Org/Tenant Concept

**None.** Zero organization, workspace, or tenant model anywhere in the codebase.

---

## Key Insights

1. **Prisma is the DB source of truth** — schema changes drive everything. Adding `Organization` starts at `prisma/schema.prisma`, then Zod schemas, then tRPC guards.

2. **User.role is global today** — must become org-scoped. A user who is a `manager` in Org A should not see Org B's data. Either add `organizationId` to `User` or introduce an `OrganizationMembership` join table (more flexible for users in multiple orgs).

3. **Musician ↔ Organization is many-to-many** — `MusicianOrganization` join table needed. Canonical many-to-many in Prisma uses explicit join model.

4. **Hotel ↔ Organization is many-to-many** — `HotelOrganization` join table. A hotel (venue) could work with multiple booking orgs.

5. **Event must be org-scoped** — `organizationId` FK on Event. Already has `hotelId` and `musicianId` (1:1). Multi-musician-per-event is a future concern; current 1:1 is fine for now.

6. **tRPC context must carry org** — `session.user.organizationId` (or derived from membership). All procedures that read/write scoped data check this.

7. **NextAuth session extension** — `organizationId` (and maybe `organizationRole`) must be added to the JWT/session user type in `/types/next-auth.d.ts`.

8. **SDD workflow is mandatory** — spec entities schema first, then Prisma, then fixtures, then tRPC, then UI.

9. **No row-level security at DB layer** — current app uses app-layer filtering. Multi-tenant isolation will follow the same pattern (add `.where({ organizationId })` to all Prisma queries).

10. **Effector stores are per-feature** — adding org context store in `features/auth/model.ts` or a new `features/org/model.ts` makes sense.

---

## Constraints & Risks

| Constraint / Risk | Detail |
|-------------------|--------|
| **Prisma migration scope** | Adding `Organization` + join tables + `organizationId` FKs on User, Hotel, Musician, Event = significant schema migration. Existing seed data has no orgs — seed must be updated. |
| **Auth session size** | JWT embeds all user fields. Adding org fields grows token. Watch Vercel's 4KB cookie limit. |
| **Global admin role** | Need a "super-admin" concept separate from org manager for platform-level administration. |
| **Data backfill** | Existing users/hotels/musicians have no org. Migration needs a default org or nullable FK with phased enforcement. |
| **tRPC guard proliferation** | Every procedure needs org-scope check. Consider an `orgProcedure` middleware that injects `ctx.organizationId` to avoid repeating the check. |
| **Musician cross-org visibility** | When a musician works for Org A and Org B, who can see their profile? Need a clear rule: each org sees only its own musician memberships, not global profiles. |
| **Hotel cross-org visibility** | Same question for hotels. |
| **Event 1:1 vs 1:many musicians** | Current schema: one musician per event. If a hotel org needs multiple musicians per event, schema needs further change. Clarify scope before building. |
| **NextAuth beta** | Using `5.0.0-beta.31` — session type changes need care. |

---

## Open Questions

1. **User ↔ Org cardinality**: Can a user (manager) belong to multiple orgs, or exactly one? If one, `organizationId` FK on `User` is simplest. If many, need `UserOrganizationMembership` join table.

2. **Musician identity vs membership**: Is a `Musician` a platform-level entity (shared profile) that an org "invites", or does each org own its own musician records? Shared profile + many-to-many is cleaner but more complex.

3. **Hotel identity vs membership**: Same question — platform-level venue with org memberships, or per-org hotel records?

4. **Org admin role**: Should managers have an `org:admin` role that can invite other managers/musicians, or keep the flat `manager` role?

5. **Org onboarding flow**: Is there a self-serve org signup, or does a super-admin create orgs? This affects the auth flow and what screens need building.

6. **Multi-musician-per-event**: Out of scope for this spike or required?

7. **Default org for existing data**: Nullable `organizationId` initially, or create a seed org and backfill?

8. **Billing/subscription**: Out of scope for now? If yes, org entity needs no billing fields yet.

---

## External References

- Prisma multi-tenant patterns: https://www.prisma.io/docs/guides/other/multi-tenancy
- NextAuth JWT session customization: https://authjs.dev/guides/extending-the-session
- tRPC context middleware: https://trpc.io/docs/server/middlewares

---

## Files to Touch (Ordered by SDD Workflow)

```
1. specs/entities/organization.schema.ts      ← NEW Zod schema
2. specs/entities/index.ts                    ← re-export
3. prisma/schema.prisma                       ← Organization model + join tables + FKs
4. prisma/migrations/<timestamp>_add_org/     ← migration file
5. prisma/seed.ts                             ← add default org, update fixtures
6. specs/fixtures/organizations.ts            ← NEW fixture data
7. specs/features/organization.scenarios.ts   ← NEW behavior scenarios
8. types/next-auth.d.ts                       ← add organizationId to session user
9. auth.ts                                    ← populate organizationId in JWT callback
10. server/trpc.ts                            ← add org to context, orgProcedure guard
11. server/routers/organizations.ts           ← NEW tRPC router (CRUD org)
12. server/routers/*.ts                       ← add org filtering to all queries
13. entities/organization/                    ← NEW entity (schema, model, index)
14. features/org/model.ts                     ← NEW Effector org store
15. shared/types/index.ts                     ← re-export Organization types
16. app/(authenticated)/admin/organizations/  ← NEW admin UI pages
17. __tests__/features/organization.test.ts   ← tests matching scenarios
```
