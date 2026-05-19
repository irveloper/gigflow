/**
 * Organization Feature Scenarios
 *
 * Source of truth for multi-tenant organization behavior.
 * Update here FIRST when requirements change.
 */

import { organizationFixtures, allOrganizations } from "@/specs/fixtures"

export const organizationScenarios = {
  creation: {
    "create org — user becomes manager with organizationId": {
      given: "authenticated user with no organizationId",
      when: "orgCreated is triggered with { name, slug }",
      then: [
        "createOrgFx is called with the input",
        "$organization store is populated with new org data",
        "$isLoading is false after creation",
        "$error is null on success",
      ],
      fixture: organizationFixtures.sonidosDelMar,
    },

    "create org clears error on retry": {
      given: "$error has a value from a previous failed attempt",
      when: "orgCreated is triggered again",
      then: ["$error is reset to null"],
    },
  },

  loading: {
    "load org — $organization is populated from API": {
      given: "authenticated user with organizationId",
      when: "loadOrg is triggered",
      then: [
        "loadMyOrgFx is called",
        "$organization is populated with the org returned by the API",
        "$isLoading is false after loading",
      ],
      fixture: organizationFixtures.sonidosDelMar,
    },

    "load org — returns null for pending user": {
      given: "authenticated user with no organizationId (pending role)",
      when: "loadOrg is triggered",
      then: [
        "loadMyOrgFx swallows the error",
        "$organization remains null",
        "$isLoading is false",
      ],
    },
  },

  update: {
    "update org — $organization reflects new name/slug": {
      given: { org: organizationFixtures.sonidosDelMar },
      when: "orgUpdated is triggered with { name: 'Nuevo Nombre' }",
      then: [
        "updateOrgFx is called",
        "$organization.name is updated to 'Nuevo Nombre'",
        "$isLoading is false after update",
      ],
    },
  },

  dataIsolation: {
    "org data isolation — manager cannot read another org's data": {
      given: "manager authenticated to org-1",
      when: "manager calls hotels.getAll with ctx.organizationId = org-2",
      then: ["procedure returns FORBIDDEN", "no hotel data is leaked"],
      note: "enforced at tRPC orgProcedure level in server/routers/hotels.ts",
    },

    "superadmin bypasses org isolation": {
      given: "superadmin user (no organizationId)",
      when: "superadmin calls organizations.listAll",
      then: [
        "all organizations are returned",
        "no FORBIDDEN error",
      ],
      expectedCount: allOrganizations.length,
      fixture: allOrganizations,
    },

    "regular manager cannot call superadmin procedures": {
      given: "manager authenticated to org-1",
      when: "manager calls organizations.listAll",
      then: ["procedure throws FORBIDDEN"],
      note: "enforced by superAdminProcedure middleware in server/trpc.ts",
    },
  },

  linking: {
    "link hotel — hotel appears in org list after linking": {
      given: "org has no hotels linked",
      when: "hotels.linkHotel is called with a hotelId",
      then: [
        "HotelOrganization join row is created",
        "hotels.getAll returns the linked hotel for this org",
        "the hotel does not appear in other orgs unless they also link it",
      ],
    },

    "link musician — musician appears in org list after linking": {
      given: "org has no musicians linked",
      when: "musicians.linkMusician is called with a musicianId",
      then: [
        "MusicianOrganization join row is created",
        "musicians.getAll returns the linked musician for this org",
      ],
    },

    "org-specific hotel contact — contactPerson differs per org": {
      given: "hotel linked to both org-1 and org-2",
      when: "hotels.updateOrgHotelContact is called for org-1",
      then: [
        "HotelOrganization.contactPerson is updated for org-1 only",
        "org-2 hotel contact is unchanged",
        "Hotel shared fields (name, email) are unchanged",
      ],
    },
  },

  musicianCrossOrg: {
    "musician cross-org event view — sees events from all orgs": {
      given: "musician linked to org-1 and org-2, with events in both",
      when: "events.getAll is called with role = 'musician'",
      then: [
        "events from both org-1 and org-2 are returned",
        "each event includes organizationName and organizationSlug",
        "no organizationId filter is applied",
      ],
    },
  },
} as const
