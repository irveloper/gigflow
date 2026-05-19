# Spec: SaaS Organization Multi-Tenancy

**Feature name:** `saas-org-multitenancy`
**Date:** 2026-05-15
**Status:** Finalized

---

## Overview

The platform is becoming a SaaS product. Multiple independent booking businesses ("Organizations") must be able to use the platform simultaneously without seeing each other's data. Each Organization manages its own roster of Hotels, Managers, and Musicians. The data of one Organization must never be visible to another.

The key product rule is that **Organizations are the top-level tenant**. Everything — hotels, musicians, events, users — is scoped to an org.

---

## Session Context

From the initial description and clarifications:
- Orgs own their Hotels and have their own Managers (many managers per org)
- A manager belongs to exactly one org — controlling multiple orgs requires a separate account
- Musicians and Hotels are **platform-level shared entities** (no copies); multiple orgs can link to the same record
- Hotels may have **org-specific contact info** stored on the membership link (different contact person per org-hotel pair)
- Org onboarding is **self-serve** — any logged-in user can create an org and become its first Manager
- Musicians see all their events **across all orgs they belong to** (no org-switching, just their own events)
- Org slug is **auto-generated from org name** but editable by the admin; used in URLs
- Super-admin is bootstrapped via **seed script**

---

## Requirements

### Organizations

1. An Organization has a name, a unique auto-generated slug (derived from name, editable by the org's Manager), and an active status.
2. The slug is used in URLs (e.g. `/org/acme-events/...`).
3. Any authenticated user can create a new Organization; the creator becomes its first Manager automatically.
4. An Organization can have many Managers.
5. Managers can view and edit their own Organization's profile (name, slug, contact info).
6. A super-admin can view and manage all Organizations from a platform-level panel.

### Users & Roles (org-scoped)

7. Every user belongs to exactly one Organization (or none, if pending).
8. A user cannot control multiple orgs — a separate account is required per org.
9. A user's role (Manager, Musician, Hotel) is scoped to their Organization — a Manager in Org A has no authority in Org B.
10. Users who register and have no org assignment land in a "Pending" state until a Manager from any org assigns them, or until they create their own org.
11. A super-admin role exists at the platform level, not scoped to any org; super-admins can see and manage data across all orgs.
12. The first super-admin is created by the seed script.

### Hotels (shared platform entities, org-linked)

13. A Hotel is a single platform-level record — no copies exist. Its core info (name, email, phone, location, avatar) is shared.
14. A Hotel can be linked to multiple Organizations (many-to-many).
15. Each org-hotel link stores an **org-specific contact person** (overrides the hotel's global contact when shown within that org's context).
16. When a Manager searches for hotels, they see the platform-wide hotel directory and can link any hotel to their org.
17. A Manager can also create a new Hotel record (which is then auto-linked to their org).
18. A Manager can edit core hotel info (shared fields) — changes are visible to all orgs that share the hotel.
19. Hotels shown in an org's event booking flow are limited to hotels linked to that org.

### Musicians (shared platform entities, org-linked)

20. A Musician is a single platform-level record — no copies exist. Core info (name, email, phone, shows, hourlyRate, avatar) is shared.
21. A Musician can be linked to multiple Organizations (many-to-many).
22. When a Manager searches for musicians, they see the platform-wide musician directory and can link any musician to their org.
23. A Manager can also create a new Musician record (which is then auto-linked to their org).
24. A Manager can edit core musician info (shared fields) — changes are visible to all orgs that share the musician.
25. Musicians shown in an org's event booking flow are limited to musicians linked to that org.

### Events

26. Every Event belongs to exactly one Organization.
27. A Manager can only create, view, and edit Events belonging to their own Organization.
28. The Hotel and Musician on an Event must both be linked to the same Organization as the Event.
29. The current 1:1 musician-per-event model is preserved (multi-musician-per-event is out of scope).

### Musician Dashboard (cross-org)

30. A Musician user sees all events assigned to them, across **all Organizations** they are linked to — no org-switching required.
31. Events from different orgs are shown together in a single unified list/calendar.

### Data Isolation

32. A Manager must never see Hotels, Musicians, Events, Users, or Notifications belonging to another Organization.
33. A Hotel user sees only events scheduled at hotels linked to their Organization.

### Admin Panel

34. The existing admin panel becomes org-scoped: a Manager sees only their org's data (hotels, musicians, events, users, notifications).
35. The super-admin panel (platform level) lists all orgs and provides drill-down into any org's data.

---

## Scope

### In scope

- `Organization` entity: name, slug (auto-gen + editable), status, contact info
- Many-to-many: Musician ↔ Organization (shared profile, no copies)
- Many-to-many: Hotel ↔ Organization (shared profile + org-specific contact person on the join)
- User membership: one user → one org (FK on User), nullable until assigned
- Self-serve org creation flow (any logged-in user → becomes Manager of new org)
- Org-scoped data access for all existing entities
- Org-scoped Manager admin panel
- Platform super-admin role + super-admin panel (list orgs, view any org's data)
- Super-admin bootstrapped via seed script
- Musician unified cross-org event view
- Org slug used in app URLs
- Updated seed/fixture data: ≥2 demo orgs, each with ≥1 Manager, ≥2 Hotels, ≥2 Musicians, ≥2 Events
- `organizationId` in auth session (JWT) for all non-super-admin users

### Out of scope

- Multi-org control per account (separate account required)
- Billing / subscription management
- Multi-musician per event
- Cross-org event transfers
- Org-level branding / white-labeling
- Organization deletion / data export
- Fine-grained permissions within an org (e.g. read-only manager)
- Org invitation / invite-link flows (pending users self-assign or are assigned by a manager)

---

## Acceptance Criteria

### Organization management

- [ ] Logged-in user creates an org → they become its first Manager and their session gains `organizationId`.
- [ ] Org slug is auto-generated from the org name (e.g. "Acme Events" → `acme-events`).
- [ ] Manager can edit their org's slug; slug must remain unique across the platform.
- [ ] App routes are prefixed with the org slug (e.g. `/org/acme-events/admin`).

### Data isolation

- [ ] Manager A logs in → sees zero Hotels, Musicians, Events, or Users from Org B.
- [ ] Manager A cannot create an Event referencing a Hotel or Musician not linked to Org A (API returns error).
- [ ] Manager A calling an Org B endpoint receives 403.

### Shared Hotel/Musician profiles

- [ ] Hotel "Paradisus" linked to Org A and Org B → a core field edit (e.g. phone) by Manager A is visible to Manager B.
- [ ] Org A has its own contact person stored for "Paradisus" (independent of Org B's contact person for the same hotel).
- [ ] Musician "Carlos" linked to Org A and Org B → Manager A links Carlos; Manager B also links Carlos; both see him in their booking flows.
- [ ] Core musician edit by Manager A is reflected in Org B's view of Carlos.

### Musician cross-org event view

- [ ] Carlos linked to Org A and Org B logs in → sees events assigned to him from both orgs in one unified list.
- [ ] Carlos sees zero events belonging to other musicians.

### User membership

- [ ] User registers → lands on "Pending" screen (no org yet).
- [ ] User creates org → immediately enters org dashboard as Manager (no pending state).
- [ ] Manager assigns a pending user to their org → user gains role and org access.
- [ ] Manager in Org A cannot assign users to Org B.

### Super-admin

- [ ] Super-admin (created by seed) can list all orgs.
- [ ] Super-admin can view data for any org.
- [ ] Super-admin is not filtered by `organizationId`.

### Seed data

- [ ] `pnpm db:seed` creates a super-admin, Org A ("Sonidos del Mar"), Org B ("Ritmo Caribe"), each with ≥1 Manager, ≥2 Hotels, ≥2 Musicians, ≥2 Events.

---

## Clarifications Recorded

| # | Question | Answer |
|---|----------|--------|
| 1 | Manager in multiple orgs? | No. One manager → one org. Separate account for another org. Many managers allowed per org. |
| 2 | Shared Hotel/Musician edits affect all orgs? | Yes — shared profile, no copies. Org-specific contact person stored on the join link only. |
| 3 | Org onboarding | Self-serve: any logged-in user can create an org and becomes its first Manager. |
| 4 | Musician sees events across orgs? | Yes — all events across all active orgs in one unified view, filtered to just their own events. |
| 5 | Super-admin bootstrap | Seed script. |
| 6 | Org slug | Auto-generated from org name; admin-editable; used in URLs. |

---

## Research Summary

*(From `osddt.research.md`)*

- **No existing org/tenant concept** — clean-slate addition.
- **User.role is global** — must gain `organizationId` FK on User (nullable until assigned).
- **Hotels and Musicians are standalone entities** — add join tables `HotelOrganization` (with `contactPerson`) and `MusicianOrganization`.
- **tRPC guards are role-only** — all procedures need org-scoped filtering; an `orgProcedure` middleware guard is recommended.
- **App-layer filtering** — isolation via `.where({ organizationId })` on all Prisma queries; no DB-level RLS.
- **Auth session** — `organizationId` added to JWT/session; watch Vercel 4KB cookie limit.
- **SDD workflow mandatory** — Zod schema → Prisma → fixtures → tRPC → UI.
- **Seed backfill risk** — existing data has no org; seed must create orgs and link existing records.
