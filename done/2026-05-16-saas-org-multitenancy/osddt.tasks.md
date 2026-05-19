# Tasks: SaaS Organization Multi-Tenancy

**Feature name:** `saas-org-multitenancy`
**Date:** 2026-05-15
**Plan:** `osddt.plan.md`

---

## Dependencies Overview

```
Phase 1 (Schema) → Phase 2 (Auth) → Phase 3 (API)
                                          ↓
                             Phase 4 (Entity/Feature layer)
                                          ↓
                             Phase 5 (Routing refactor)
                                   ↓           ↓
                      Phase 6 (Org creation)   Phase 8 (Super-admin)
                                   ↓
                      Phase 7 (Hotel/Musician linking UI)
                                   ↓
                      Phase 9 (Musician cross-org view)
                                   ↓
                      Phase 10 (Specs & Tests)
```

---

## Phase 1 — Schema Foundation

> **Definition of Done:** `pnpm db:seed` succeeds; existing vitest suite passes with no regressions; DB has Organization, HotelOrganization, MusicianOrganization tables; all seed users/hotels/musicians/events have an organizationId.

- [x] [S] Create `specs/entities/organization.schema.ts` — Zod schemas for `Organization`, `CreateOrganizationInput`, `UpdateOrganizationInput`, `HotelOrganization`, `MusicianOrganization`
- [x] [S] Update `specs/entities/index.ts` — re-export new schemas
- [x] [S] Update `shared/types/index.ts` — re-export `Organization`, `CreateOrganizationInput`, `UpdateOrganizationInput` types
- [x] [M] Update `prisma/schema.prisma`:
  - Add `Organization` model (id, name, slug unique, status, createdAt, updatedAt)
  - Add `HotelOrganization` explicit join model (hotelId, organizationId, contactPerson?, contactPhone?, @@id compound)
  - Add `MusicianOrganization` explicit join model (musicianId, organizationId, @@id compound)
  - Add `organizationId String?` + relation to `User`
  - Add `organizationId String?` + relation to `Event` (nullable; required after backfill)
  - Add `'superadmin'` to role enum/string values (comment in schema)
- [x] [S] Run `prisma migrate dev --name add_org_multitenancy` and commit migration file
- [x] [S] Create `specs/fixtures/organizations.ts` — two deterministic org fixtures (Sonidos del Mar, Ritmo Caribe)
- [x] [M] Update `prisma/seed.ts` — super-admin, Org A + B, 2 managers, hotel links with org-specific contacts, musician links (Miguel cross-org), 2 events per org, all users org-assigned

---

## Phase 2 — Auth & Session

> **Definition of Done:** After seeded Manager logs in, `session.user.organizationId` and `session.user.organizationSlug` are populated. Super-admin login has no `organizationId`. `orgProcedure` and `superAdminProcedure` exist in `server/trpc.ts`.

- [x] [S] Update `types/next-auth.d.ts` — add `organizationId?: string`, `organizationSlug?: string` to session user; add `'superadmin'` to role union type
- [x] [M] Update `auth.ts` JWT callback — `authorize` includes org via `include: { organization }`, populates `token.organizationId` + `token.organizationSlug`
- [x] [S] Update `auth.ts` session callback — copy `organizationId` and `organizationSlug` from token to `session.user`
- [x] [M] Update `server/trpc.ts` — `organizationId` in context; `orgProcedure` (superadmin bypasses); `superAdminProcedure`

---

## Phase 3 — Core tRPC API

> **Definition of Done:** All data reads/writes are org-scoped. A Manager calling a Org B endpoint receives FORBIDDEN. `organizations` router is registered. `linkHotel` / `linkMusician` / `unlinkHotel` / `unlinkMusician` endpoints exist.

- [x] [M] Create `server/routers/organizations.ts` — `checkSlug`, `create` (sets user as manager), `getMyOrg`, `update`, `listAll` (superadmin)
- [x] [M] Update `server/routers/hotels.ts` — org-scoped `getAll`/`getById`, org-specific contact override, `create` auto-links, `update`/`delete` verify link, `linkHotel`, `unlinkHotel`, `updateOrgHotelContact`, `search`
- [x] [M] Update `server/routers/musicians.ts` — same pattern: org-scoped reads, `create` auto-links, `update`/`delete` verify link, `linkMusician`, `unlinkMusician`, `search`
- [x] [M] Update `server/routers/events.ts` — org-scoped all ops; musician cross-org `getAll` by email match; `create` validates hotel+musician linked to same org
- [x] [S] Update `server/routers/admin.ts` — `listUsers`/`createUser`/`deactivateUser` filtered by `ctx.organizationId`
- [x] [S] `server/routers/notifications.ts` — already scoped by `userId`; no change needed
- [x] [S] Register `organizationsRouter` in `server/routers/index.ts`

---

## Phase 4 — Entity & Feature Layer

> **Definition of Done:** `$organization` Effector store exists; `loadMyOrgFx` fires on auth resolve; entities barrel-exports are clean.

- [x] [S] `entities/organization/schema.ts` — already created in Phase 1
- [x] [S] Create `entities/organization/model.ts` — `$organization` store, `organizationSet`, `organizationCleared` events
- [x] [S] Create `entities/organization/index.ts` — barrel export (model + schema types)
- [x] [M] Create `shared/api/organizations.ts` + `features/org/model.ts` — `loadMyOrgFx` (swallows no-org errors), `createOrgFx`, `updateOrgFx`; wires to `checkAuthFx.doneData` to auto-load org on auth resolve
- [x] [S] Auth wiring handled in `features/org/model.ts` (imports `checkAuthFx` from auth); no change to `features/auth/model.ts` needed

---

## Phase 5 — Routing Refactor

> **Definition of Done:** All authenticated org routes are under `/org/[slug]/`; `app/page.tsx` redirects correctly; `/auth/pending` links to org creation; no broken internal links.

- [x] [M] Create `app/org/[slug]/layout.tsx` — server component; reads session; validates `slug === session.user.organizationSlug` (super-admin bypasses); renders existing authenticated layout shell (providers, navigation)
- [x] [L] Move authenticated page files from `app/(authenticated)/` into `app/org/[slug]/`:
  - `admin/hotels/page.tsx`
  - `admin/musicians/page.tsx`
  - `admin/events/page.tsx`
  - `admin/users/page.tsx`
  - `calendar/page.tsx`
  - `check-in/[eventId]/page.tsx`
  - `hotel/dashboard/page.tsx`
  - `profile/page.tsx`
  - `notifications/page.tsx`
  - `reports/page.tsx`
- [x] [S] Update `app/page.tsx` — server component redirect: authenticated + org → `/org/[slug]`; authenticated + no org → `/auth/pending`; unauthenticated → `/auth/login`
- [x] [S] Update `app/auth/pending/page.tsx` — add "Create your organization" CTA button linking to `/org/new`
- [x] [M] Update all internal `<Link>` hrefs and `router.push()` calls across widgets and pages to use `/org/${slug}/...`
- [x] [S] Update `widgets/navigation/ui.tsx` — accept and use `slug` prop for all nav link hrefs
- [x] [S] Add Next.js redirects in `next.config.mjs` for legacy paths (e.g. `/admin/:path*` → `/org/:slug/admin/:path*`) as a compatibility shim during transition

---

## Phase 6 — Org Creation Flow

> **Definition of Done:** Any logged-in user can create an org; after creation they land in `/org/[slug]/admin`; session is refreshed with new `organizationId`.

- [x] [M] Create `app/org/new/page.tsx` — form with name input; slug preview (auto-generated, editable); availability indicator (debounced `checkSlug` tRPC call); submit button
- [x] [S] Create `app/org/new/actions.ts` — server action calling `organizations.create` tRPC; on success calls `NextAuth update()` to refresh session; returns slug for redirect
- [x] [S] Add slug generation util to `lib/utils.ts` (lowercase, replace spaces/special chars with `-`, dedupe `-`, max 50 chars)

---

## Phase 7 — Hotel & Musician Linking UI

> **Definition of Done:** Manager can search platform-wide hotels/musicians and link them to their org; org-specific contact person is editable per hotel; linked-only entities appear in booking flows.

- [x] [M] Update `app/org/[slug]/admin/hotels/page.tsx` — two tabs: "My Hotels" (linked) + "Add Hotel" (platform search + link button + create new button)
- [x] [S] Create `app/org/[slug]/admin/hotels/[hotelId]/page.tsx` — hotel detail: shared fields section (editable, affects all orgs) + "Your org's contact" section (contactPerson, contactPhone — stored on join)
- [x] [M] Update `widgets/admin-hotels/` — accept org context; render linked status; link/unlink actions
- [x] [M] Update `app/org/[slug]/admin/musicians/page.tsx` — same two-tab pattern as hotels
- [x] [S] Create `app/org/[slug]/admin/musicians/[musicianId]/page.tsx` — musician detail (shared fields only; no org-specific contact needed for musicians)
- [x] [M] Update `widgets/admin-musicians/` — accept org context; link/unlink actions

---

## Phase 8 — Super-Admin Panel

> **Definition of Done:** Super-admin user can list all orgs, click into any org, and see its data; regular managers cannot access `/superadmin/`.

- [x] [S] Create `app/superadmin/layout.tsx` — server component guard: role must be `superadmin`; renders minimal admin shell
- [x] [M] Create `app/superadmin/organizations/page.tsx` — table: org name, slug, manager count, hotel count, musician count, event count, created date
- [x] [M] Create `app/superadmin/organizations/[orgId]/page.tsx` — org detail view: lists hotels, musicians, events, users for that org (read-only)
- [x] [S] Create `app/superadmin/page.tsx` — redirect to `/superadmin/organizations`

---

## Phase 9 — Musician Cross-Org Event View

> **Definition of Done:** Musician user sees all events assigned to them from every org they are linked to, in a single unified list; each event shows its org name as a label.

- [x] [M] Update `server/routers/events.ts` musician query — when `session.user.role === 'musician'`, query events by `musicianId` (matched via email or explicit FK) with no `organizationId` filter; include `organization { name, slug }` in response
- [x] [S] Resolve musician User ↔ Musician record link — add `musicianId String?` FK to `User` in Prisma schema + migration; update seed to set it; update JWT callback to populate `session.user.musicianId`
- [x] [S] Update event list / calendar widgets — render org name badge on each event card when the viewing user is a musician

---

## Phase 10 — Specs & Tests

> **Definition of Done:** `pnpm test:run` passes; organization scenarios file exists; all new tRPC procedures have at least one test; no existing tests regressed.

- [x] [M] Create `specs/features/organization.scenarios.ts` — scenarios:
  - `create org` → user becomes manager; session has organizationId
  - `org data isolation` → manager cannot read another org's hotels/musicians/events
  - `link hotel` → hotel appears in org list; shared edit is visible across orgs
  - `link musician` → same pattern
  - `org-specific hotel contact` → contactPerson differs per org for same hotel
  - `musician cross-org event view` → sees events from multiple orgs
  - `superadmin list all orgs` → returns all orgs; regular manager call returns FORBIDDEN
- [x] [L] Create `__tests__/features/organization.test.ts` — vitest tests matching each scenario above; use fixtures from `specs/fixtures/`
- [x] [M] Update existing tests in `__tests__/` that assumed global data — add org context to fixtures and mocked session objects
- [x] [S] Run `pnpm test:run` and fix any regressions

---

## Summary

| Phase | Tasks | Complexity |
|-------|-------|-----------|
| 1 — Schema Foundation | 7 | S×4 + M×2 + S×1 |
| 2 — Auth & Session | 4 | S×2 + M×2 |
| 3 — Core tRPC API | 7 | M×5 + S×2 |
| 4 — Entity/Feature Layer | 5 | S×4 + M×1 |
| 5 — Routing Refactor | 7 | S×4 + M×2 + L×1 |
| 6 — Org Creation Flow | 3 | S×2 + M×1 |
| 7 — Hotel & Musician Linking UI | 6 | S×2 + M×4 |
| 8 — Super-Admin Panel | 4 | S×2 + M×2 |
| 9 — Musician Cross-Org View | 3 | S×2 + M×1 |
| 10 — Specs & Tests | 4 | S×1 + M×2 + L×1 |
| **Total** | **50** | |
