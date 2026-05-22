# Spec: Hotel Location Fields

**Feature name:** `hotel-location-fields`  
**Date:** 2026-05-22

---

## Overview

Hotels are currently stored with a single free-text `location` field (e.g., `"Blvd. Kukulcan Km 16.5, Zona Hotelera, Cancún"`). This is sufficient for display but makes it impossible to filter, group, or validate hotel locations by country, state, or city.

An organization can have hotels in different countries. The platform needs structured location data so that admins can register hotels with a proper address — including country, state/province, city, and street address — and so that hotel cards and detail views can display location in a consistent, readable format.

---

## Requirements

### Hotel entity

- A hotel must store the following location fields:
  - **Country** — selected from a standard list of countries (ISO-based); required
  - **State / Province** — selected from the states/provinces of the chosen country; required where the country has states, optional otherwise
  - **City** — text input or selection; required
  - **Street address** — free-text; required (replaces the old `location` string)
  - **Postal code** — required free-text

### Creating a hotel

- When creating a new hotel, the admin must fill in: country, city, street address, postal code. State is required if the selected country has states/provinces.

### Editing a hotel

- From the hotel detail page, an admin can update any location field.
- All location fields behave identically on create and edit.

### Hotel card display

- The hotel card (in the admin hotels list) must display location as **"City, State, Country"** (or **"City, Country"** when no state is present), replacing the current free-text `location` display.

### Hotel detail view

- The hotel detail page must show each location field separately (country, state, city, street address, postal code).
- Each field must be individually editable.

### Filtering and search (future-ready, not required now)

- The data model must allow future filtering of hotels by country or city (structured columns required; no feature-level filtering needed in this iteration).

---

## Scope

### In scope

- Replacing the `location: String` field with structured location fields on the `Hotel` entity
- Updating create and edit forms to collect structured location
- Updating hotel card and detail view to display structured location
- Migrating existing hotel records (all Mexico-based) to the new structure with sensible defaults
- Updating fixtures, scenarios, and tests to use the new structure

### Out of scope

- Filtering or searching hotels by country/city in the UI
- Org-specific location overrides (location is global to the hotel, like `name` and `email`)
- GPS coordinates (latitude/longitude) for hotels
- Phone number formatting per country
- Address autocomplete via external APIs

---

## Acceptance Criteria

1. **Hotel creation** — when an admin creates a hotel, the form includes fields for country (dropdown), state (dropdown, filtered by selected country, hidden/optional for countries with no states), city (cascading dropdown filtered by state), street address (text), and postal code (required text). Submitting without required fields is rejected with a validation message.

2. **Hotel edit** — the hotel detail page shows the current country, state, city, street address, and postal code as separate editable fields. Saving updates the hotel record.

3. **Hotel card** — each hotel card in the admin list shows location as `"City, State, Country"` (or `"City, Country"` when no state exists), replacing the old free-text `location` line.

4. **Data integrity** — `country` and `city` are always non-empty on any hotel record. `state` may be empty for countries without states/provinces.

5. **Existing data** — existing hotel records are migrated: the old `location` string is moved to the `address` field; `country` defaults to `"Mexico"` / `countryCode` to `"MX"`. No hotel record is left with null required fields after migration.

6. **Tests pass** — all existing hotel tests pass with updated fixtures. At least one test scenario covers a hotel with a non-Mexico country to verify the multi-country model works.

---

## Decisions

1. **Drop `location` immediately**: project is in active development; reset and re-migrate is acceptable. Single migration replaces `location` with structured fields.
2. **Postal code required**: all hotels must have a postal code.
3. **Cascading dropdowns**: country → state → city dropdowns using `country-state-city` data for validated structured input.
4. **Migration default country**: `countryCode: 'MX'`, `country: 'Mexico'` for all existing rows; old `location` string moved to `address`.

---

## Research Summary

- **Current state**: `location` is a single `String` field in both Prisma and Zod; no structured address data exists anywhere in the Hotel entity.
- **Relation**: Hotels are shared across orgs (many-to-many via `HotelOrganization`); location fields belong on the global `Hotel` record, not the join table.
- **Recommended package**: `country-state-city` (TypeScript-first, ISO 3166-1/3166-2, countries + states + cities, 2M+ weekly downloads). Used only in client-side form components.
- **Risk**: Prisma migration must handle existing rows — all currently Mexico-based, so a default `countryCode: 'MX'` covers them.
- **Pattern**: Scalar DB columns preferred over JSON for filterable location data (consistent with how other Hotel fields are stored).
