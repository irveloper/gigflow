# Plan: Backend Integration

**Feature**: `best-way-to-add-backend-for`
**Date**: 2026-04-26
**Branch**: main

---

## Architecture Overview

### Two-phase strategy

**Phase 1 — API-driven mock layer**
Every Effector effect currently imports fixtures directly and wraps them in `setTimeout`. Phase 1 introduces a typed service layer (`shared/api/`) that effects call instead. Implementations still return fixture data, but through proper async functions — no `setTimeout`, no direct fixture imports inside effects. This creates a clean seam for Phase 2.

**Phase 2 — Real Supabase integration**
Swap the mock implementations in `shared/api/` for real Supabase queries. Because effects only call `shared/api/` functions, this phase touches no store wiring, no widgets, and no UI components.

### Service layer

```
shared/api/
  events.ts       ← fetchEvents(), createEvent(), updateEvent(), deleteEvent()
  musicians.ts    ← fetchMusicians(), createMusician(), updateMusician()
  hotels.ts       ← fetchHotels(), createHotel(), updateHotel()
  notifications.ts← fetchNotifications(), markNotificationRead()
  check-in.ts     ← submitCheckIn(), confirmCheckIn(), rejectCheckIn()
  auth.ts         ← login(), logout(), getSession(), register()
  storage.ts      ← uploadCheckInPhoto(), getSignedPhotoUrl()
```

Phase 1: each function returns fixture data asynchronously.
Phase 2: each function calls `supabase.from(...)` or `supabase.storage...` / `supabase.auth...`.

### Supabase client setup

Two clients are needed in a Next.js App Router project:

- `lib/supabase/client.ts` — browser client (used inside Effector effects, Client Components)
- `lib/supabase/server.ts` — server client via `@supabase/ssr` (used in middleware, Server Components, Route Handlers)

### Auth flow

Supabase Auth with email/password. `@supabase/ssr` manages cookies so the session is available server-side. The current middleware reads `auth-token` cookie manually — it will be replaced with `supabase.auth.getUser()` using the server client.

Role is stored in a `profiles` table with `userId`, `role`, and `isActive` columns. A user's role is `null` (pending) until assigned by a manager. The Effector `$user` store merges the Supabase auth user with the profile row.

### Row-Level Security (RLS)

| Table | Musician | Manager | Hotel |
|-------|----------|---------|-------|
| `events` | own rows only (`musician_id = auth.uid()`) | all rows | own rows only (`hotel_id = profile.hotel_id`) |
| `notifications` | own rows only | own rows only | own rows only |
| `musicians` | own row only | all rows | — |
| `hotels` | — | all rows | own row only |
| `profiles` | own row | all rows | own row |

### Realtime

Two subscriptions only (per Decision 3):

1. `notifications` channel — `INSERT` on rows where `user_id = current user` → fires Effector event to prepend notification to `$notifications`
2. `events` channel — `UPDATE` on rows where `status = 'in-progress' AND checked_in = true` → fires Effector event to refresh `$pendingCheckIns`

```ts
// TODO: extend realtime to all entity mutations (events, musicians, hotels)
// when broader live-sync is needed across clients
```

### Storage

Bucket: `checkin-photos` (private — signed URLs required)
Path pattern: `{userId}/{eventId}/{filename}`
Signed URL TTL: 1 hour (regenerated on access)

---

## Implementation Phases

### Phase 0 — Project setup

**Goal**: Install dependencies, scaffold the service layer structure, configure environment variables.

Steps:
1. Install `@supabase/supabase-js` and `@supabase/ssr`
2. Install Supabase CLI as a dev dependency (`supabase`)
3. Create `lib/supabase/client.ts` and `lib/supabase/server.ts` with typed client factories
4. Add `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (placeholder values for Phase 1)
5. Scaffold empty `shared/api/` files (typed signatures, no implementations yet)

---

### Phase 1 — API-driven mock layer

**Goal**: Decouple all Effector effects from direct fixture imports. Effects call `shared/api/` — implementations return fixture data, but the effects have no knowledge of where data comes from.

Steps per domain (events, musicians, hotels, notifications, auth, check-in):

1. Implement each `shared/api/` function to return the relevant fixture data asynchronously (`Promise.resolve(...)`)
2. Update each `features/*/model.ts` `createEffect` body to call `shared/api/` instead of returning fixtures directly
3. Remove all `import { allEvents }` / `import { allMusicians }` etc. from effect files
4. `submitCheckInFx`: call `shared/api/check-in.ts#submitCheckIn()` which returns a mock result (fake photo URL, timestamp)
5. `loginFx`: call `shared/api/auth.ts#login()` which validates against `userFixtures` and returns a user object (same logic as today, but isolated to the service layer)
6. `checkAuthFx`: call `shared/api/auth.ts#getSession()` which reads from `localStorage` (same as today, but isolated)

**Acceptance**: All 50 existing tests still pass. No `setTimeout` anywhere in `features/*/model.ts`. No fixture imports in effect bodies.

---

### Phase 2 — Database schema & migrations

**Goal**: Define the production database schema. Maps directly from existing Zod schemas.

Steps:
1. Initialize Supabase project locally (`supabase init`, `supabase start`)
2. Write migration `001_create_tables.sql`:
   - `profiles(id, user_id, role, is_active, hotel_id)`
   - `musicians(id, name, email, phone, hourly_rate, is_active, created_at)`
   - `hotels(id, name, email, phone, location, contact_person, is_active, created_at)`
   - `events(id, title, date, time, duration_minutes, hotel_id, musician_id, status, checked_in, check_in_time, check_in_photo, check_in_location, check_in_comments, created_at)`
   - `notifications(id, user_id, title, message, type, read, timestamp)`
3. Write migration `002_rls.sql`: enable RLS on all tables, add policies per role as defined in the RLS section above
4. Write migration `003_storage.sql`: create `checkin-photos` bucket, set access to private
5. Write `supabase/seed.sql`: INSERT statements for all fixture users, musicians, hotels, events, notifications

---

### Phase 3 — Auth integration

**Goal**: Replace localStorage/cookie auth with Supabase Auth. Middleware updated to use server-side session check.

Steps:
1. Update `shared/api/auth.ts#login()` to call `supabase.auth.signInWithPassword({ email, password })`
2. Update `shared/api/auth.ts#logout()` to call `supabase.auth.signOut()`
3. Update `shared/api/auth.ts#getSession()` to call `supabase.auth.getUser()` + fetch profile row for role
4. Update `shared/api/auth.ts#register()` to call `supabase.auth.signUp()` + insert a `profiles` row with `role = null`
5. Update Next.js middleware to use `@supabase/ssr` `createServerClient` + `supabase.auth.getUser()` for route protection — remove manual cookie parsing
6. Remove `localStorage` and `document.cookie` manipulation from auth model

**Role assignment**: Add a manager-only page or panel where the manager can set `profiles.role` for pending users. Until a role is assigned, the user sees a "pending role" state after login.

---

### Phase 4 — Data layer integration

**Goal**: Swap `shared/api/` mock implementations for real Supabase queries. Effects are untouched.

Steps per domain:
1. **Events**: `fetchEvents()` → `supabase.from('events').select('*').order('date')` (RLS handles role filtering); `createEvent()` → `.insert()`; `updateEvent()` → `.update().eq('id', id)`; `deleteEvent()` → `.delete().eq('id', id)`
2. **Musicians**: standard CRUD via `supabase.from('musicians')`
3. **Hotels**: standard CRUD via `supabase.from('hotels')`
4. **Notifications**: `fetchNotifications()` → `.select().eq('user_id', userId).order('timestamp', { ascending: false })`; `markNotificationRead()` → `.update({ read: true }).eq('id', id)`
5. Parse all Supabase responses through the matching Zod schema (e.g. `EventSchema.array().parse(data)`) to catch shape drift at the effect boundary

---

### Phase 5 — Check-in with file upload

**Goal**: Check-in photos uploaded to Supabase Storage; signed URL stored on the event record.

Steps:
1. `shared/api/storage.ts#uploadCheckInPhoto(userId, eventId, file)`:
   - Upload to `checkin-photos/{userId}/{eventId}/{filename}`
   - Return `supabase.storage.from('checkin-photos').createSignedUrl(path, 3600)`
2. Update `shared/api/check-in.ts#submitCheckIn()`:
   - Call `uploadCheckInPhoto()` first
   - Update event row: `status='in-progress'`, `checked_in=true`, `check_in_photo=signedUrl`, `check_in_time`, `check_in_location`, `check_in_comments`
3. `confirmCheckIn()`: update event `status='completed'` + insert notification for musician
4. `rejectCheckIn()`: update event `status='scheduled'`, `checked_in=false`, clear check-in fields + insert notification for musician

---

### Phase 6 — Realtime subscriptions

**Goal**: Notifications deliver live; manager's pending check-ins list updates live.

Steps:
1. Create `shared/api/realtime.ts` with two subscription factories:
   - `subscribeToNotifications(userId, onInsert)` → `supabase.channel(...).on('postgres_changes', { event: 'INSERT', table: 'notifications', filter: 'user_id=eq.{userId}' }, onInsert)`
   - `subscribeToPendingCheckIns(onUpdate)` → channel on `events` UPDATE filtered to `status=eq.in-progress`
2. Wire subscriptions to Effector events (not stores directly):
   - `notificationReceived` event → existing `$notifications` sample wiring picks it up
   - `pendingCheckInUpdated` event → `$pendingCheckIns` derived store recalculates
3. Start subscriptions on auth, stop on logout (clean up channels)
4. Add TODO comment block near subscription setup for future broader realtime

---

### Phase 7 — Seed data

**Goal**: Populate dev/demo database with fixture data.

Steps:
1. Create demo Supabase Auth users matching `userFixtures` (via `supabase.auth.admin.createUser()` or seed SQL using `auth.users` insert)
2. Seed SQL (`supabase/seed.sql`) inserts all fixture musicians, hotels, events, notifications
3. Document dev setup in a `CONTRIBUTING.md` or inline comments: `supabase start && supabase db reset` for fresh local env

---

### Phase 8 — Role assignment UI

**Goal**: Managers can assign roles to new users who signed up with no role.

Steps:
1. Add a "Pending Users" section to the admin area (managers only)
2. Fetch `profiles` rows where `role IS NULL`
3. Manager selects a role from a dropdown → update `profiles.role`
4. User's next `getSession()` call picks up the new role

---

## Technical Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Browser + server Supabase client |
| `@supabase/ssr` | Next.js App Router cookie-based session management |
| `supabase` (CLI, dev) | Local dev server, migrations, type generation |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| RLS policy bug exposes wrong data | Write integration tests against `supabase start` local instance |
| Zod schema ↔ Supabase column shape drift | Parse all Supabase responses through Zod at the effect boundary; `supabase gen types typescript` to cross-check |
| Realtime subscription memory leaks | Unsubscribe on auth state change + component unmount; test with two browser tabs |
| Middleware cookie migration breaks existing routes | E2E test the redirect behaviour before and after |
| Signed URL expiry (1h) causes broken photo links | Store path separately; regenerate signed URL on demand instead of storing the URL |
| Role = null users see broken UI | Gate app shell on role being set; show "pending role assignment" screen otherwise |
| Phase 1 mock layer diverges from Phase 2 contract | Typed interfaces in `shared/api/` enforce the same signatures in both phases |

---

## Out of Scope

- Changing any existing UI or UX
- Adding new pages or entities beyond the 5 existing ones
- Offline / sync-on-reconnect for check-in
- Multi-tenancy (multiple independent hotel chains)
- Email or push notification delivery (in-app only)
- Realtime updates for all entity mutations (events, musicians, hotels) — TODO for future
- Admin panel for managing Supabase users outside the app UI
