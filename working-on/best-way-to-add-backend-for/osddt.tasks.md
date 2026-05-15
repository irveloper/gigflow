# Tasks: Backend Integration

**Feature**: `best-way-to-add-backend-for`
**Date**: 2026-04-26

---

## Phase 0 — Project setup

**Definition of Done**: App still builds and runs. Service layer files exist with typed signatures. Supabase CLI available. No runtime changes yet.

- [x] [S] Install `@supabase/supabase-js` and `@supabase/ssr` as production dependencies
- [x] [S] Install `supabase` CLI as a dev dependency
- [x] [S] Create `lib/supabase/client.ts` — typed browser Supabase client factory
- [x] [S] Create `lib/supabase/server.ts` — typed server Supabase client factory using `@supabase/ssr`
- [x] [S] Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` (placeholder values)
- [x] [M] Scaffold `shared/api/` with typed function signatures (no implementations): `events.ts`, `musicians.ts`, `hotels.ts`, `notifications.ts`, `check-in.ts`, `auth.ts`, `storage.ts`

---

## Phase 1 — API-driven mock layer

**Dependencies**: Phase 0 complete
**Definition of Done**: All 50 existing tests pass. No `setTimeout` in `features/*/model.ts`. No fixture imports inside `createEffect` bodies. Effects call `shared/api/` exclusively.

- [x] [M] Implement `shared/api/events.ts` mock — `fetchEvents()`, `createEvent()`, `updateEvent()`, `deleteEvent()` return fixture data via `Promise.resolve()`
- [x] [M] Implement `shared/api/musicians.ts` mock — `fetchMusicians()`, `createMusician()`, `updateMusician()` return fixture data
- [x] [M] Implement `shared/api/hotels.ts` mock — `fetchHotels()`, `createHotel()`, `updateHotel()` return fixture data
- [x] [M] Implement `shared/api/notifications.ts` mock — `fetchNotifications()`, `markNotificationRead()` return fixture data
- [x] [M] Implement `shared/api/auth.ts` mock — `login()` validates against `userFixtures`, `logout()` clears localStorage, `getSession()` reads from localStorage, `register()` is a no-op stub
- [x] [S] Implement `shared/api/storage.ts` mock — `uploadCheckInPhoto()` returns a fake URL string, `getSignedPhotoUrl()` returns the same
- [x] [M] Implement `shared/api/check-in.ts` mock — `submitCheckIn()` calls `uploadCheckInPhoto()` then returns a merged event; `confirmCheckIn()` and `rejectCheckIn()` return updated events
- [x] [M] Update `features/events/model.ts` effects to call `shared/api/events.ts` — remove direct fixture imports from effect bodies
- [x] [M] Update `features/musicians/model.ts` effects to call `shared/api/musicians.ts`
- [x] [M] Update `features/hotels/model.ts` effects to call `shared/api/hotels.ts`
- [x] [M] Update `features/notifications/model.ts` effects to call `shared/api/notifications.ts`
- [x] [M] Update `features/auth/model.ts` effects (`loginFx`, `logoutFx`, `checkAuthFx`, `registerFx`) to call `shared/api/auth.ts`
- [x] [M] Update `features/check-in/model.ts` `submitCheckInFx` to call `shared/api/check-in.ts`
- [x] [S] Run full test suite — verify all 50 tests pass

---

## Phase 2 — Database schema & migrations

**Dependencies**: Phase 0 complete (Supabase CLI available)
**Definition of Done**: `supabase db reset` runs cleanly. All tables, RLS policies, and storage bucket created. Seed data populates all tables.

- [x] [S] Run `supabase init` to initialize the local Supabase project
- [x] [M] Write migration `001_create_tables.sql`:
  - `profiles(id, user_id uuid FK auth.users, role text, is_active bool, hotel_id uuid nullable)`
  - `musicians(id uuid PK, name, email, phone, hourly_rate numeric, is_active bool, created_at timestamptz)`
  - `hotels(id uuid PK, name, email, phone, location, contact_person, is_active bool, created_at timestamptz)`
  - `events(id uuid PK, title, date date, time time, duration_minutes int, hotel_id FK, musician_id FK, status text, checked_in bool, check_in_time timestamptz, check_in_photo text, check_in_location jsonb, check_in_comments text, created_at timestamptz)`
  - `notifications(id uuid PK, user_id uuid FK, title, message, type text, read bool, timestamp timestamptz)`
- [x] [M] Write migration `002_rls.sql`:
  - Enable RLS on all 5 tables
  - `events`: musician sees own (musician_id = auth.uid()), manager sees all, hotel sees own hotel rows
  - `notifications`: user sees own rows only
  - `musicians`: own row for musician role, all rows for manager
  - `hotels`: own row for hotel role, all rows for manager
  - `profiles`: own row for all roles, all rows for manager
- [x] [S] Write migration `003_storage.sql` — create `checkin-photos` bucket with private access (RLS: authenticated users can upload to their own path)
- [x] [M] Write `supabase/seed.sql` — INSERT all fixture users into `auth.users` + `profiles`, musicians, hotels, events, notifications
- [ ] [S] Run `supabase start && supabase db reset` — verify clean run with seed data

---

## Phase 3 — Auth integration

**Dependencies**: Phase 1 complete, Phase 2 complete
**Definition of Done**: Login/logout/session-check all use Supabase Auth. Middleware uses server-side session. No localStorage JSON blobs. Role loads from `profiles` table.

- [ ] [M] Update `shared/api/auth.ts#login()` — call `supabase.auth.signInWithPassword({ email, password })` then fetch `profiles` row for role
- [ ] [S] Update `shared/api/auth.ts#logout()` — call `supabase.auth.signOut()`
- [ ] [M] Update `shared/api/auth.ts#getSession()` — call `supabase.auth.getUser()` + fetch `profiles` row; return `null` if no session
- [ ] [M] Update `shared/api/auth.ts#register()` — call `supabase.auth.signUp()` then insert `profiles` row with `role = null`
- [ ] [M] Update Next.js middleware (`middleware.ts` / `proxy.ts`) — replace manual cookie parsing with `@supabase/ssr` `createServerClient` + `supabase.auth.getUser()` for route protection
- [ ] [S] Remove `localStorage` and `document.cookie` manipulation from `features/auth/model.ts`
- [ ] [S] Handle `role = null` case in auth model — surface a "pending role" state to `$user` store
- [ ] [S] Verify route protection still works: unauthenticated → redirect to login

---

## Phase 4 — Data layer integration

**Dependencies**: Phase 2 complete (tables + RLS exist), Phase 3 complete (auth works)
**Definition of Done**: All CRUD operations persist to the database. RLS enforces role-based visibility. Zod parsing validates all response shapes at effect boundaries.

- [ ] [M] Replace `shared/api/events.ts` mock with Supabase queries — `fetchEvents()` uses `.select('*').order('date')`, CRUD uses `.insert()` / `.update()` / `.delete()`; parse with `EventSchema.array()`
- [ ] [M] Replace `shared/api/musicians.ts` mock with Supabase queries; parse with `MusicianSchema`
- [ ] [M] Replace `shared/api/hotels.ts` mock with Supabase queries; parse with `HotelSchema`
- [ ] [M] Replace `shared/api/notifications.ts` mock with Supabase queries; parse with `NotificationSchema`
- [ ] [S] Remove fixture data imports from `shared/api/` files (now fetching real data)
- [ ] [S] Manual smoke-test: create an event as manager, verify it appears after hard refresh; log in as musician, verify only assigned events are visible

---

## Phase 5 — Check-in with file upload

**Dependencies**: Phase 4 complete, Phase 2 `003_storage.sql` applied
**Definition of Done**: Check-in photo uploaded to Supabase Storage. Signed URL stored on event record. Confirm/reject updates event status correctly.

- [ ] [M] Implement `shared/api/storage.ts#uploadCheckInPhoto(userId, eventId, file)` — upload to `checkin-photos/{userId}/{eventId}/{filename}`, return path
- [ ] [S] Implement `shared/api/storage.ts#getSignedPhotoUrl(path)` — call `supabase.storage.from('checkin-photos').createSignedUrl(path, 3600)`
- [ ] [M] Update `shared/api/check-in.ts#submitCheckIn()` — upload photo, get signed URL, update event row in DB
- [ ] [S] Update `shared/api/check-in.ts#confirmCheckIn()` — set `status='completed'`, insert notification for musician
- [ ] [S] Update `shared/api/check-in.ts#rejectCheckIn()` — set `status='scheduled'`, clear check-in fields, insert notification for musician
- [ ] [S] Manual smoke-test: submit check-in with photo; verify photo URL stored on event; verify manager sees pending check-in; verify confirm/reject updates event status

---

## Phase 6 — Realtime subscriptions

**Dependencies**: Phase 4 complete
**Definition of Done**: Notifications arrive live without refresh. Manager's pending check-ins list updates live when musician checks in. Subscriptions cleaned up on logout.

- [ ] [M] Create `shared/api/realtime.ts` with `subscribeToNotifications(userId, onInsert)` factory using `supabase.channel().on('postgres_changes', ...)`
- [ ] [M] Create `subscribeToPendingCheckIns(onUpdate)` factory in `shared/api/realtime.ts` — listens for `events` UPDATE where `status = 'in-progress'`
- [ ] [S] Add `// TODO: extend realtime to all entity mutations (events, musicians, hotels) when broader live-sync is needed` comment near subscription setup
- [ ] [M] Wire `subscribeToNotifications` to Effector — on INSERT fire `notificationReceived` event that prepends to `$notifications`
- [ ] [M] Wire `subscribeToPendingCheckIns` to Effector — on UPDATE fire event that triggers `loadEventsFx` or patches `$events` directly
- [ ] [S] Start subscriptions after successful login; unsubscribe all channels on logout
- [ ] [S] Test with two browser tabs: musician checks in on tab 1, verify manager sees pending check-in on tab 2 without refresh

---

## Phase 7 — Seed data

**Dependencies**: Phase 2 `supabase/seed.sql` written
**Definition of Done**: `supabase db reset` populates all tables. Demo users can log in with known credentials. All fixture events, musicians, hotels visible after seed.

- [ ] [M] Finalize `supabase/seed.sql` — ensure fixture users are inserted into both `auth.users` (with hashed passwords) and `profiles` (with correct roles)
- [ ] [S] Verify seed: `supabase db reset` + log in as each demo user (musician, manager, hotel) and verify expected data is visible
- [ ] [S] Document dev setup steps (supabase start → supabase db reset → pnpm dev) in `CONTRIBUTING.md` or a comment block in `.env.local.example`

---

## Phase 8 — Role assignment UI

**Dependencies**: Phase 3 complete (auth + profiles table)
**Definition of Done**: Manager can view users with no role and assign them one. Assigned users see full app on next login. Pending users see a clear "waiting for role" screen.

- [ ] [M] Add "Pending Users" section to admin area (managers only) — fetch `profiles` where `role IS NULL`
- [ ] [S] Add role assignment dropdown + save button per pending user — calls `supabase.from('profiles').update({ role }).eq('user_id', id)`
- [ ] [S] Add "pending role" screen — shown when `$user.role === null`, with message explaining the user's account is awaiting role assignment
- [ ] [S] Verify: sign up as new user → see pending screen → manager assigns role → user refreshes → sees full app

---

## Dependencies Summary

```
Phase 0
  └── Phase 1 (mock layer — can be done in parallel with Phase 2)
  └── Phase 2 (DB schema)
        └── Phase 3 (auth — needs profiles table)
              └── Phase 4 (data layer — needs auth + tables)
                    ├── Phase 5 (check-in upload — needs events table + storage)
                    ├── Phase 6 (realtime — needs events + notifications tables)
                    └── Phase 8 (role UI — needs profiles table)
        └── Phase 7 (seed — needs all tables from Phase 2)
```

Phase 1 and Phase 2 can be worked in parallel after Phase 0.
