# Research: Best Way to Add Backend

**Feature**: `best-way-to-add-backend-for`
**Date**: 2026-04-25
**Branch**: main

---

## Topic

The project is currently a fully client-side Next.js 16 app with all data sourced from in-memory fixtures. Every `createEffect` handler fakes a network call with `setTimeout`. The goal is to determine the best backend approach that integrates cleanly with the existing architecture (Next.js App Router, Effector, Zod schemas, FSD).

---

## Codebase Findings

### Current data flow

```
specs/fixtures/*.ts → shared/mocks/*.ts → features/*/model.ts (createEffect)
                                                        ↓
                                               entities/*/model.ts ($store)
```

Every loading effect follows the same fake pattern:
```ts
export const loadEventsFx = createEffect<void, Event[]>(async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  return allEvents  // ← fixture data
})
```

Replacing `return allEvents` with a real API call is the **only code change required per effect** — the Effector `sample` wiring, derived stores, and UI components are all unaffected.

### Auth model (`features/auth/model.ts`)

- `loginFx`: validates against `userFixtures`, writes user JSON to `localStorage` + `document.cookie`
- `checkAuthFx`: reads from `localStorage`, verifies ID is in the demo set
- No JWT, no server-side session, no token refresh
- Comment: "proxy.ts reads these server-side" — there is a middleware proxy that reads the `auth-token` cookie to gate routes

### Entity schemas (Zod, `entities/*/schema.ts`)

| Entity | Key fields |
|--------|------------|
| Event | id, title, date (YYYY-MM-DD), time (HH:MM), durationMinutes, hotelId, musicianId, status, checkedIn, checkInPhoto, checkInLocation |
| Musician | id, name, email, phone, shows[], hourlyRate, isActive |
| Hotel | id, name, email, phone, location, contactPerson, isActive |
| Notification | id, title, message, type, read, timestamp |
| User | id, email, name, role (musician/manager/hotel) |

All schemas are already in `entities/*/schema.ts` and exported via `shared/types/index.ts`. A backend DB schema is basically a direct mapping.

### No API routes yet

`app/api/` does not exist. Zero backend infrastructure currently.

### Next.js config

```js
// next.config.mjs
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
}
```

No special backend requirements, no Edge runtime, no custom server.

### File upload need

`CheckInInput` schema includes `photo: z.instanceof(File)` — check-in requires file upload to some storage backend.

### Real-time needs

- Notifications: musicians receive notifications after check-in; managers need live updates of pending check-ins
- Check-in status: manager dashboard shows `$pendingCheckIns` — ideally reactive without polling

---

## Candidate Options

### Option A — Next.js Route Handlers + Prisma + PostgreSQL

**How it works**: Add `app/api/` route handlers; use Prisma ORM for type-safe DB access; host PostgreSQL on Neon/Railway/Supabase hosted.

**Pros**:
- Zero new infrastructure concepts — stays 100% in Next.js
- Prisma types can be generated from schema and mapped to existing Zod types
- Full SQL control
- Familiar REST or tRPC API shape

**Cons**:
- Realtime requires separate setup (polling, WebSockets, or SSE)
- File upload needs separate storage (S3, Cloudinary, etc.)
- Auth must be built (NextAuth.js or DIY JWT)
- Most setup work of all options

**Effort**: ~4-6 days

---

### Option B — Supabase ⭐ Recommended

**How it works**: Supabase is a hosted PostgreSQL platform with a REST/realtime API, Auth, and Storage — all accessible via a single TypeScript SDK.

**Pros**:
- **PostgreSQL** matches the relational data model (events FK → musicians, hotels)
- **Row Level Security (RLS)**: enforce role-based access at DB level — musician sees only own events, manager sees all. Replaces the app-layer `filterEventsForCalendar` guard at the data-fetch level
- **Realtime subscriptions** via `supabase.channel().on('postgres_changes', ...)`: notifications and pending check-ins update live
- **Storage**: `supabase.storage.from('checkin-photos').upload(...)` handles the `checkInPhoto` field
- **Auth**: proper JWT-based auth with role claims replaces the current localStorage/cookie hack; `supabase.auth.signInWithPassword()` drops into `loginFx` directly
- **Type generation**: `supabase gen types typescript` produces types from the DB schema — can be validated against existing Zod schemas
- **Free tier**: 500 MB DB, 1 GB storage, 50k realtime connections — sufficient for dev + demo

**Effect migration** is minimal — one function body changes per effect:
```ts
// BEFORE
export const loadEventsFx = createEffect<void, Event[]>(async () => {
  await new Promise(r => setTimeout(r, 500))
  return allEvents
})

// AFTER
export const loadEventsFx = createEffect<void, Event[]>(async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return EventSchema.array().parse(data)
})
```

**Auth migration**: replace `loginFx` body with `supabase.auth.signInWithPassword({ email, password })`, remove localStorage, remove `document.cookie` manipulation. The Supabase session cookie is handled by `@supabase/ssr`.

**Cons**:
- External service dependency (can self-host with Supabase CE if needed)
- RLS policies are SQL — new concept if team is unfamiliar
- Vendor lock-in (mitigated by: Supabase is open source, runs on standard PostgreSQL)

**Effort**: ~2-3 days

---

### Option C — Convex

**How it works**: Reactive TypeScript serverless backend with integrated DB, real-time, file storage, and auth.

**Pros**:
- Reactive by default — no subscription setup needed
- TypeScript-first schema and functions
- Good DX

**Cons**:
- Requires rewriting Effector effects as Convex queries/mutations (bigger refactor)
- New primitives to learn
- Less familiar SQL-style access
- No direct Zod-to-Convex schema bridge

**Effort**: ~4-5 days

---

### Option D — PocketBase

**How it works**: Single self-hosted binary, REST API, realtime, auth, file storage.

**Pros**:
- No external cloud dependency
- Simple admin UI
- Realtime built-in

**Cons**:
- Go-based — less TypeScript tooling for types
- No type generation from schema
- Less ecosystem than Supabase

**Effort**: ~3-4 days

---

## Key Insights

1. **Effector effects are the only integration point.** The FSD architecture means the UI, derived stores, and all widget logic are unaffected. Only `features/*/model.ts` `createEffect` bodies change. This makes any backend swap low-risk.

2. **Zod schemas → DB tables is a 1:1 map.** No schema design needed — the work is translating existing Zod schemas to `CREATE TABLE` SQL (Supabase) or Prisma schema. This is mechanical.

3. **Supabase RLS replaces app-layer role guards.** Currently `filterEventsForCalendar` filters events client-side by role. With Supabase RLS, the DB returns only the rows the user is allowed to see — cleaner and more secure.

4. **Real-time is a feature, not a luxury.** The manager confirmation dashboard (`$pendingCheckIns`) and musician notifications (`$notifications`) both benefit from reactive updates. Without realtime, these require polling which degrades UX. Supabase realtime is the easiest path.

5. **Check-in photo upload** (`CheckInInput.photo: File`) requires a storage backend. Supabase Storage is already included in the plan.

6. **Auth needs to be proper.** The current `localStorage` + `document.cookie` pattern is a demo hack — it stores the full user JSON in a cookie, which is insecure. Supabase Auth provides proper JWT sessions with `@supabase/ssr` for Next.js server-side cookie management.

7. **No API routes needed with Supabase.** The Supabase JS SDK calls the Supabase API directly from the client (with RLS enforcement) or from Server Components. No `app/api/` boilerplate required for CRUD. Custom business logic (e.g., sending notifications on check-in) goes in Supabase Edge Functions or Next.js Route Handlers.

---

## Constraints & Risks

| Risk | Mitigation |
|---|---|
| RLS policy bugs expose wrong data | Write integration tests against Supabase local dev (`supabase start`) |
| Zod v4 + Supabase types mismatch | Use `EventSchema.parse(data)` at effect boundary to catch shape drift |
| Real-time subscriptions leak on unmount | Use Effector's `createEffect` cleanup or `useEffect` return to call `channel.unsubscribe()` |
| Check-in photo URLs need to be stored | Save `supabase.storage.getPublicUrl(path)` into the `events.checkInPhoto` column after upload |
| Supabase free tier limits | 500 MB DB, 1 GB storage — fine for this project scale |
| Migration from localStorage auth mid-demo | Use `supabase.auth.onAuthStateChange` to sync Effector `$user` store |

---

## Open Questions

1. **Deployment target**: Where will the app be hosted? Vercel (Supabase + Vercel is the standard combo), self-hosted, or local-only?
2. **Existing demo data**: Should fixture data be seeded into the real DB, or should the demo use Supabase anon key + seed SQL?
3. **Real-time scope**: Should realtime be implemented for all entities (events, notifications) or just notifications?
4. **Edge Functions vs Route Handlers**: For custom business logic (e.g., send notification when manager confirms check-in), use Supabase Edge Functions or Next.js Route Handlers?
5. **Multi-tenancy**: Is this a single hotel group or should the schema support multiple hotel chains? (affects RLS design)
6. **Offline support**: Should check-in work offline with sync-on-reconnect? (affects architecture significantly)
