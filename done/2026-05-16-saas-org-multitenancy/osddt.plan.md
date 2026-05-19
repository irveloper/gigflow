# Plan: SaaS Organization Multi-Tenancy

**Feature name:** `saas-org-multitenancy`
**Date:** 2026-05-15
**Spec:** `osddt.spec.md`

---

## Architecture Overview

### Tenancy strategy
App-layer filtering — every Prisma query involving org-owned data appends `.where({ organizationId })`. No DB-level RLS. A single `orgProcedure` tRPC middleware injects `ctx.organizationId` from the session and throws FORBIDDEN if missing.

### Data model additions

```
Organization
  id, name, slug (unique), status ('active'|'inactive'), createdAt, updatedAt

HotelOrganization  ← join table (many-to-many + org-specific contact)
  hotelId, organizationId, contactPerson, contactPhone
  @@id([hotelId, organizationId])

MusicianOrganization  ← join table (many-to-many)
  musicianId, organizationId
  @@id([musicianId, organizationId])

User
  + organizationId  String?  (nullable; null = pending / superadmin)

Event
  + organizationId  String   (required after migration)
```

### Role model
`User.role` gains a new value: `'superadmin'`. Super-admins have no `organizationId`. Existing roles (`manager`, `musician`, `hotel`) are now implicitly org-scoped via `organizationId` FK. No join table needed — one user, one org.

### URL structure
Authenticated org routes move under `/org/[slug]/`. A layout at that level validates the slug matches the session org (or super-admin pass-through).

```
/                          → redirect to /org/[slug] or /auth/login
/org/[slug]/               → org home (dashboard)
/org/[slug]/admin/...      → manager-only
/org/[slug]/calendar
/org/[slug]/check-in/[id]
/org/[slug]/notifications
/org/[slug]/profile
/org/[slug]/reports
/superadmin/               → super-admin only
/auth/login
/auth/register
/auth/pending              → no org yet; option to create one
```

### Session additions
```ts
// types/next-auth.d.ts
organizationId?: string
organizationSlug?: string
// role gains 'superadmin' as valid value
```

### SDD workflow (mandatory, enforced per phase)
Zod schema → Prisma migration → fixtures → tRPC → entities/features → UI → tests

---

## Implementation Phases

### Phase 1 — Schema Foundation

**Goal:** All types and DB structures exist; nothing is wired to the UI yet.

**Steps:**
1. `specs/entities/organization.schema.ts` — Zod schema for `Organization`, `HotelOrganization`, `MusicianOrganization`
2. `specs/entities/index.ts` — re-export new schemas
3. `shared/types/index.ts` — re-export `Organization`, `CreateOrganizationInput`, `UpdateOrganizationInput`
4. `prisma/schema.prisma`:
   - Add `Organization` model
   - Add `HotelOrganization` explicit join model (with `contactPerson`, `contactPhone`)
   - Add `MusicianOrganization` explicit join model
   - Add `organizationId String?` to `User` + FK relation
   - Add `organizationId String` to `Event` + FK relation (nullable in migration, required after backfill)
   - Add `role` value `superadmin` (string enum in Prisma)
5. `prisma/migrations/` — run `prisma migrate dev --name add_org_multitenancy`
6. `prisma/seed.ts`:
   - Create super-admin user (`role: 'superadmin'`, no `organizationId`)
   - Create Org A ("Sonidos del Mar", slug: `sonidos-del-mar`)
   - Create Org B ("Ritmo Caribe", slug: `ritmo-caribe`)
   - Link existing hotels/musicians to orgs via join tables
   - Set `organizationId` on all existing events and users
7. `specs/fixtures/organizations.ts` — deterministic fixture data for 2 orgs

**Acceptance gate:** `pnpm db:seed` succeeds; `pnpm test:run` passes on existing tests (no regressions).

---

### Phase 2 — Auth & Session

**Goal:** Session carries `organizationId` + `organizationSlug`; super-admin role recognized.

**Steps:**
1. `types/next-auth.d.ts` — add `organizationId?: string`, `organizationSlug?: string`; add `'superadmin'` to role union
2. `auth.ts` — JWT callback: after loading user from DB, populate `organizationId` and `organizationSlug` from `user.organization.slug`; skip for superadmin
3. `server/trpc.ts`:
   - Add `organizationId` to tRPC context (read from `session.user.organizationId`)
   - Add `orgProcedure` — extends `protectedProcedure`, throws `FORBIDDEN` if `ctx.organizationId` is null and role is not `superadmin`
   - Add `superAdminProcedure` — extends `protectedProcedure`, throws `FORBIDDEN` if role is not `superadmin`

**Acceptance gate:** Existing login still works; `session.user.organizationId` is populated for seeded Manager users; super-admin user has no `organizationId` in session.

---

### Phase 3 — Core tRPC API (org-scoped)

**Goal:** All data reads/writes are org-filtered; organization CRUD exists.

**Steps:**
1. `server/routers/organizations.ts` — NEW router:
   - `create` (protectedProcedure) — creates org, sets `User.organizationId`, updates session
   - `getMyOrg` (orgProcedure) — returns current org
   - `update` (orgProcedure, manager-only) — update name/slug/contact
   - `listAll` (superAdminProcedure) — returns all orgs (super-admin only)
2. `server/routers/hotels.ts` — update all queries:
   - `getAll`: filter by orgs the user's `organizationId` is linked to (via `HotelOrganization`)
   - `getById`: verify hotel is linked to `ctx.organizationId`
   - `create`: auto-link new hotel to `ctx.organizationId` via join
   - `update`: verify hotel linked to `ctx.organizationId` before mutating
   - `delete`: verify linked; remove join entry (not the hotel record itself if other orgs use it)
   - Add `linkHotel` — links an existing hotel to the current org with optional `contactPerson`/`contactPhone`
   - Add `unlinkHotel` — removes org-hotel join
3. `server/routers/musicians.ts` — same pattern as hotels:
   - `getAll`, `getById`, `create`, `update`, `delete`, `linkMusician`, `unlinkMusician`
4. `server/routers/events.ts` — add `organizationId` to all queries + creation input
5. `server/routers/admin.ts` — `listUsers`, `createUser`, `deactivateUser` filter by `ctx.organizationId`
6. `server/routers/notifications.ts` — `getAll` joins via event → `organizationId` or via `User.organizationId`
7. `server/index.ts` — register `organizationsRouter`

**Acceptance gate:** `pnpm test:run` (unit tests pass); manual: Manager A cannot fetch Org B hotels via tRPC.

---

### Phase 4 — Entity & Feature Layer

**Goal:** Effector stores and entity layer reflect org model.

**Steps:**
1. `entities/organization/schema.ts` — import from `specs/entities/organization.schema.ts`
2. `entities/organization/model.ts` — Effector store `$organization` (current org data)
3. `entities/organization/index.ts` — barrel export
4. `features/org/model.ts` — effects:
   - `createOrgFx` (calls `organizations.create` tRPC)
   - `loadMyOrgFx` (calls `organizations.getMyOrg`)
   - `updateOrgFx`
5. Update `features/auth/model.ts` — after `checkAuthFx` resolves, trigger `loadMyOrgFx` if `organizationId` is present

---

### Phase 5 — Routing Refactor

**Goal:** Authenticated routes live under `/org/[slug]/`; redirects preserve UX.

**Steps:**
1. Create `app/org/[slug]/layout.tsx`:
   - Server component; reads session
   - If `session.user.organizationSlug !== slug` and user is not super-admin → redirect to correct org slug or 403
   - Renders the existing authenticated layout shell (navigation, providers)
2. Move existing authenticated pages from `app/(authenticated)/` into `app/org/[slug]/`:
   - `admin/hotels/`, `admin/musicians/`, `admin/events/`, `admin/users/`
   - `calendar/`, `check-in/[eventId]/`, `hotel/dashboard/`, `profile/`, `notifications/`, `reports/`
3. `app/page.tsx` — server component redirect:
   - Authenticated + has org → `/org/[slug]`
   - Authenticated + no org → `/auth/pending`
   - Not authenticated → `/auth/login`
4. `app/auth/pending/page.tsx` — update to include "Create your organization" CTA (links to new org creation flow)
5. Update all internal `<Link>` hrefs and `router.push()` calls to use `/org/${slug}/...` pattern
6. `widgets/navigation/ui.tsx` — pass `slug` prop; update nav links

---

### Phase 6 — Org Creation Flow (self-serve)

**Goal:** Any logged-in user can create an org and enter the platform as Manager.

**Steps:**
1. `app/org/new/page.tsx` — org creation form (name input; slug auto-generated, editable)
2. `app/org/new/actions.ts` or client call to `organizations.create` tRPC
3. On success: session is refreshed (NextAuth `update()`) → redirect to `/org/[slug]/admin`
4. `app/auth/pending/page.tsx` — "Create Organization" button → `/org/new`
5. Slug uniqueness validated client-side (debounced tRPC check) + server-side on submit

---

### Phase 7 — Hotel & Musician Linking UI

**Goal:** Managers can link existing platform entities to their org or create new ones.

**Steps:**
1. `app/org/[slug]/admin/hotels/page.tsx` — replace simple list with:
   - Tab A: "My Hotels" (linked) — existing table
   - Tab B: "Add Hotel" — searchable platform-wide directory + "Link" button + "Create New" button
2. `app/org/[slug]/admin/hotels/[hotelId]/page.tsx` — hotel detail:
   - Shared fields (name, email, phone, location) — editable (affects all orgs)
   - Org-specific section: "Contact person for your org" (stored on `HotelOrganization`)
3. Same pattern for `app/org/[slug]/admin/musicians/`
4. Widget updates: `widgets/admin-hotels/`, `widgets/admin-musicians/` — accept org context

---

### Phase 8 — Super-Admin Panel

**Goal:** Super-admin can see and manage all orgs from a dedicated section.

**Steps:**
1. `app/superadmin/layout.tsx` — guards: role must be `superadmin`
2. `app/superadmin/organizations/page.tsx` — lists all orgs (name, slug, manager count, created date)
3. `app/superadmin/organizations/[orgId]/page.tsx` — org detail; links to hotels/musicians/events for that org
4. `app/superadmin/page.tsx` — redirect to `/superadmin/organizations`
5. Navigation: super-admin gets a different nav with "Platform Admin" section

---

### Phase 9 — Musician Cross-Org Event View

**Goal:** Musician user sees all their events across every org they are linked to.

**Steps:**
1. `server/routers/events.ts` — `getAll` for `role === 'musician'`:
   - Query events where `musicianId === session.user.musicianId` (no org filter)
   - Musician sees events from all orgs they work for
2. Effector store / `loadEventsFx` in `features/events/model.ts` — no change needed if tRPC handles the filter server-side
3. Verify calendar and event-list widgets display org name as a label on each event (so musician knows which org booked them)

---

### Phase 10 — Specs & Tests

**Goal:** Test coverage matches scenario structure; no regressions.

**Steps:**
1. `specs/features/organization.scenarios.ts` — scenarios:
   - `create org` → user becomes manager, session has organizationId
   - `org isolation` → manager cannot read another org's data
   - `link hotel` → hotel appears in org's list; shared edit affects all orgs
   - `link musician` → same pattern
   - `musician cross-org view` → sees events from multiple orgs
   - `superadmin access` → can list all orgs
2. `__tests__/features/organization.test.ts` — vitest tests matching each scenario
3. Update existing tests that assumed global (unfiltered) data to use org-scoped fixtures

---

## Technical Dependencies

| Dependency | Already present | Notes |
|------------|----------------|-------|
| Prisma 7 | ✅ | Add new models + migration |
| Zod 4 | ✅ | New org schema |
| NextAuth v5 | ✅ | Extend session type + JWT callback |
| tRPC v11 | ✅ | New router + `orgProcedure` middleware |
| Effector 23 | ✅ | New org store |
| Next.js App Router | ✅ | New `/org/[slug]/` route group |
| `slugify` or manual slug gen | ❌ | Small util; implement inline or add `slugify` package |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Prisma FK backfill** — existing Events/Users have no `organizationId`; required FK fails migration | Make `organizationId` nullable in migration; seed assigns values; a follow-up migration makes it required once all rows are populated |
| **JWT size** — adding `organizationId` + `organizationSlug` to a session already carrying many fields | Audit token size; drop denormalized fields (location, contactPerson, shows) from JWT — fetch on-demand from `auth.me` tRPC instead |
| **URL refactor breaks deep links** — moving pages into `/org/[slug]/` changes all routes | Add `next.config` redirects for old paths during transition; update all `<Link>` hrefs in one pass |
| **Shared entity edit conflicts** — Manager A and Manager B edit the same hotel simultaneously | Optimistic last-write-wins (acceptable for now; no spec requirement for conflict resolution) |
| **Slug collisions** — two orgs pick the same slug | Unique constraint in Prisma; client-side availability check (debounced); server-side unique error returned as friendly message |
| **Session stale after org creation** — new `organizationId` not in JWT until re-login | Use NextAuth `update()` (available in v5 beta) to refresh session in-place after org creation |
| **Musician `musicianId` on User** — current schema has no link between User and Musician records | Need to resolve: add `musicianId` FK to User, or match by email. Plan uses email match for now; can be made explicit FK in a follow-up |

---

## Out of Scope

- Multi-org membership per account
- Billing / subscription
- Multi-musician per event
- Org deletion / data export
- White-labeling
- Fine-grained intra-org permissions
- Invite-link flows (pending users self-assign or manager assigns)
- DB-level row security (RLS)
