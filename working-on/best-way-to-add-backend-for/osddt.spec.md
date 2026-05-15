# Spec: Backend Integration

**Feature**: `best-way-to-add-backend-for`
**Date**: 2026-04-24
**Branch**: main

---

## Overview

The app is currently a fully client-side Next.js application powered by in-memory fixture data and a fake authentication system that stores user JSON in localStorage and cookies. All data operations return hardcoded arrays after a `setTimeout` delay.

This feature replaces the demo data layer with a real backend: persistent data storage, proper user authentication with role-based access, file storage for check-in photos, and live updates for manager dashboards and musician notifications. The goal is to make the app production-ready so that real hotels, musicians, and managers can use it with their actual event data.

---

## Research Summary

The research file (`osddt.research.md`) evaluated four backend options and found:

- **Only the Effector effect function bodies need to change.** The FSD architecture (store wiring, derived stores, UI components, widgets) is entirely unaffected by the swap — the integration surface is exactly one function body per effect.
- **Existing Zod schemas in `entities/*/schema.ts` already define the database shape** — the mapping from schemas to DB tables is mechanical.
- **Current auth is insecure**: full user JSON stored in a cookie, no JWT, no token refresh.
- **Real-time is needed** for two features: the manager's pending check-ins dashboard and musician notification delivery after events.
- **File upload is required**: `CheckInInput.photo` accepts a `File` object — check-in photos must be stored somewhere.
- **Role-based data filtering currently happens client-side** (`filterEventsForCalendar`) — a real backend should enforce data access at the query level instead.
- **Recommendation: Supabase** — provides PostgreSQL, role-based row-level security, realtime subscriptions, file storage, and JWT auth all in one service with a TypeScript SDK that drops directly into the existing Effector effect pattern.

---

## Session Context

The current stack as confirmed during research:

- Next.js 16 (App Router), Effector for state, Zod for schemas, FSD architecture
- Five entities: `Event`, `Musician`, `Hotel`, `Notification`, `User`
- Three roles: `musician`, `manager`, `hotel`
- Check-in flow: musician submits photo + location → manager sees it as "pending confirmation" → manager confirms or rejects
- Middleware (`proxy.ts`) currently reads an `auth-token` cookie to gate routes — this must continue to work after auth migration
- No `app/api/` directory exists today

---

## Requirements

### Authentication

1. Users must be able to log in with an email and password.
2. Logged-in sessions must persist across page refreshes and browser restarts.
3. Users must be able to log out, ending their session immediately.
4. The system must distinguish between three roles: `musician`, `manager`, and `hotel`.
5. Unauthenticated users must be redirected to the login page when accessing protected routes (same behaviour as today).
6. New user accounts must be creatable (registration flow already exists in the UI).

### Data persistence

7. Events, musicians, hotels, and notifications must be stored in a real database and survive server restarts.
8. Changes made by one user (e.g. a manager creating an event) must be visible to other users without requiring a page reload for CRUD operations.

### Role-based data access

9. A musician must only see events assigned to them.
10. A manager must see all events across all musicians and hotels.
11. A hotel user must only see events at their property.
12. Access enforcement must happen at the data source level, not solely in client-side filters.

### Event management

13. Managers must be able to create, edit, cancel, and complete events.
14. Event data (title, date, time, duration, assigned musician, hotel) must be saved and retrievable.

### Check-in

15. Musicians must be able to submit a check-in with a photo, GPS location, timestamp, and optional comments.
16. Check-in photos must be stored durably and retrievable via a stable URL.
17. After a musician submits a check-in, the event's status must be updated to reflect pending manager confirmation.
18. Managers must be able to confirm or reject a pending check-in.
19. Completing a check-in confirmation must update the event status (confirmed → completed, rejected → back to scheduled or cancelled per business rule).

### Notifications

20. When a musician submits a check-in, the relevant manager must receive a notification.
21. When a manager confirms or rejects a check-in, the musician must receive a notification.
22. Notifications must appear in the UI without requiring a manual page refresh (live delivery).
23. Users must be able to mark notifications as read.

---

## Scope

### In scope

- Replacing all fake `setTimeout`-based effects with real data operations
- Persistent storage for all five entity types
- Proper JWT-based authentication with role persistence
- Row-level data access enforcement by role
- Check-in photo file storage with stable public URLs
- Live notification delivery and live pending check-in list for managers
- Seeding the database with the existing fixture data for demo/development purposes

### Out of scope

- Changing the UI or UX of any existing page
- Adding new entity types or new pages
- Offline/sync-on-reconnect support for check-in submission
- Multi-tenancy (multiple independent hotel chains) — single-tenant assumed
- Email or push notification delivery (in-app only)
- Admin panel for managing users outside the existing UI

---

## Acceptance Criteria

1. **Login persists**: A user who logs in, closes the browser tab, and reopens the app is still logged in.
2. **Logout clears session**: After logout, navigating to any protected route redirects to login.
3. **Role isolation**: Logged in as a musician, the calendar shows only that musician's events. Logged in as a manager, all events are visible.
4. **Event CRUD**: A manager can create an event; it appears in the database and is visible after a hard refresh. Editing and deleting also reflect after refresh.
5. **Check-in photo stored**: After submitting a check-in with a photo, the photo is accessible via a URL stored on the event record.
6. **Pending check-ins live update**: When musician A submits a check-in on device 1, the manager's pending check-ins list on device 2 updates without a manual refresh.
7. **Notification live delivery**: When a manager confirms a check-in on device 1, the musician sees a new notification on device 2 without refreshing.
8. **No fixture data in production**: After migration, no `setTimeout`, `allEvents`, or other in-memory fixture imports remain in any `createEffect` body.
9. **Existing tests pass**: All 50 existing unit/scenario tests continue to pass (they test pure logic, not the data layer).
10. **Route protection unchanged**: Accessing a protected route without a valid session still redirects to login.

---

---

## Decisions

1. **Deployment target**: Vercel. Use `@supabase/ssr` with Next.js App Router cookie adapter.
2. **Role assignment**: Roles are assigned by an admin/manager after account creation. New users have no role until assigned.
3. **Real-time scope**: Live updates limited to notifications and pending check-ins only. Broader entity real-time is a future improvement — mark with `// TODO: extend realtime to events/musicians/hotels` at the subscription setup.
4. **Check-in rejection behaviour**: Rejected check-in reverts event to `scheduled` so the musician can retry.
5. **Seed data**: Yes — seed all fixture data (events, musicians, hotels, users) into the database for dev/demo use.
6. **Photo access control**: Check-in photos require authentication to view (signed URLs, not public bucket).
7. **Implementation phases**: Phase 1 — replace all hardcoded fixture effects with event-driven mocked API responses (no `setTimeout`, no direct fixture imports in effects). Phase 2 — swap mock API layer for real Supabase integration.
