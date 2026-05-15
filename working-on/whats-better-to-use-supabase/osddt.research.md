# Research: Supabase SDK directly vs Prisma + Supabase

**Feature**: `whats-better-to-use-supabase`
**Date**: 2026-04-27
**Branch**: main

---

## Topic

Should the app query the database using the Supabase JS SDK (`@supabase/supabase-js`) directly, or should it use Prisma ORM connected to the same Supabase PostgreSQL database? This is a data-access architecture decision that affects type safety, security (RLS), real-time capabilities, deployment complexity, and developer experience.

---

## Codebase Findings

### Current state

The project is mid-implementation of the backend integration. The relevant files:

- **`shared/api/*.ts`** — 8 service layer files with typed function signatures. Currently hold mock implementations returning fixture data. Phase 4 will swap these for real DB calls. This is the exact layer where the Supabase SDK vs Prisma decision applies.
- **`lib/supabase/client.ts`** — `createBrowserClient` from `@supabase/ssr` for client-side calls
- **`lib/supabase/server.ts`** — `createServerClient` from `@supabase/ssr` for server-side calls
- **`supabase/migrations/`** — 3 migrations already written:
  - `001_create_tables.sql` — all 5 tables with exact column types
  - `002_rls.sql` — full RLS policy set per role (musician/manager/hotel)
  - `003_storage.sql` — `checkin-photos` bucket with signed URL access
- **`supabase/seed.sql`** — deterministic seed data with UUID references

### Features already committed to Supabase-specific services

| Feature | Supabase service | Prisma equivalent |
|---------|-----------------|-------------------|
| Auth (login/logout/session) | GoTrue (`supabase.auth.*`) | None — must add separately |
| Realtime notifications | Supabase Realtime WebSockets | None — must add separately (e.g. Ably, Pusher) |
| Check-in photo storage | Supabase Storage | None — must add separately (e.g. S3, Cloudinary) |
| Role-based data access | Row Level Security (enforced by PostgREST) | Bypassed by default |

All three of Auth, Realtime, and Storage are already wired into the `shared/api/` contracts. They require Supabase-specific SDK calls regardless of whether Prisma is used for DB queries.

### RLS is central to the security model

`002_rls.sql` defines role-based access policies for all 5 tables. These policies are enforced automatically when queries go through the Supabase SDK (PostgREST + JWT). If Prisma connects directly to PostgreSQL:

- Prisma uses a superuser or `service_role` connection — **RLS is bypassed entirely by default**
- To enforce RLS with Prisma, every request must manually call `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims TO '...'` before each query — complex, error-prone, and not Prisma's intended use pattern
- This is not a theoretical risk: the manager/musician data separation (musician sees only own events) is the core product requirement

---

## External References

### Supabase SDK directly

- Queries go through **PostgREST** (HTTP REST API layer on top of Postgres)
- `supabase.from('events').select('*')` → PostgREST → Postgres with RLS enforced
- Type generation: `supabase gen types typescript --project-id <ref>` produces a `Database` type that makes all table/column names type-safe
- Auth, Realtime, Storage: all in one SDK, all use the same JWT for consistent access control
- No connection pooling issues in serverless — queries are HTTP calls to PostgREST, not direct DB connections

### Prisma + Supabase

- Prisma connects to the PostgreSQL DB directly via `DATABASE_URL` connection string
- Provides an ORM with `prisma.event.findMany({ where: { musicianId: id } })`
- Prisma Migrate (`prisma migrate dev`) conflicts with `supabase migration` — two separate migration systems for the same DB
- **Serverless problem**: Prisma holds long-lived connection pools; in Vercel serverless functions, each invocation can open a new DB connection, exhausting Postgres connection limits. Fix requires Prisma Accelerate (paid add-on) or Supabase's PgBouncer connection string — extra configuration
- **RLS bypass**: Direct connection to Postgres runs as `postgres` role or `service_role` — all RLS policies are silently skipped. To enable RLS, must use the `anon` or `authenticated` connection and manually inject JWT context per request
- Realtime, Auth, Storage: Prisma has none of these — `@supabase/supabase-js` still required for these features, meaning **two separate clients** in the codebase

### When Prisma genuinely wins

- Complex relational queries (deep nested includes, computed fields)
- DB-agnostic code (switching between Postgres, MySQL, SQLite)
- Teams who don't want to write SQL for migrations
- No need for RLS, Realtime, or Supabase-specific Auth

---

## Key Insights

### 1. Using both creates two data layers with conflicting ownership

If Prisma is added alongside the Supabase SDK, the codebase ends up with:
- Prisma for CRUD queries (`prisma.event.findMany()`)
- Supabase SDK for Auth (`supabase.auth.signInWithPassword()`)
- Supabase SDK for Realtime (`supabase.channel(...)`)
- Supabase SDK for Storage (`supabase.storage.from(...)`)
- Two different clients, two different connection strategies, two migration systems

This is the worst of both worlds: the complexity of Prisma without eliminating the Supabase SDK.

### 2. RLS bypass is a security regression, not a minor inconvenience

The entire role-based access model (musician sees only own events, hotel sees only own hotel's events) is built into `002_rls.sql`. Bypassing this with a Prisma superuser connection means the app must reimplement all those filters in application code — the same client-side filtering anti-pattern the backend was specifically designed to fix.

### 3. The service layer in `shared/api/` is the natural seam

The `shared/api/*.ts` files already provide clean, typed interfaces that Effector effects call. The implementation behind these functions is hidden from the rest of the app. Swapping in Prisma vs Supabase SDK only changes the function bodies in these 8 files — it doesn't affect any other architecture. This means the decision is reversible without touching Effector models, stores, or UI.

### 4. Supabase type generation is adequate for this data model

`supabase gen types typescript` generates a `Database` type that covers all tables, columns, and their TypeScript types. Combined with the existing Zod schemas at the effect boundary (`EventSchema.array().parse(data)`), type safety is sufficient. Prisma's type generation is more ergonomic for complex relations, but the 5-table schema here is simple enough that it's not a meaningful advantage.

### 5. Serverless + direct Postgres connections = connection exhaustion

Vercel runs each route as a serverless function. Each cold-start opens a new connection pool. Prisma's default pool of 10 connections × many concurrent function invocations quickly hits Postgres's connection limit (Supabase free tier: 60 connections; paid: up to 500). Supabase SDK calls PostgREST over HTTP — stateless, no pooling issues.

---

## Constraints & Risks

| Risk | Supabase SDK | Prisma + Supabase |
|------|-------------|-------------------|
| RLS enforced | ✅ Automatic (PostgREST) | ❌ Bypassed unless manually re-implemented |
| Serverless connection limits | ✅ HTTP — no pooling | ⚠️ Requires Prisma Accelerate or PgBouncer |
| Realtime | ✅ Built-in | ❌ Not available — separate service needed |
| Auth | ✅ Built-in | ❌ Not available — Supabase SDK still needed |
| Storage | ✅ Built-in | ❌ Not available — Supabase SDK still needed |
| Type safety | ✅ `supabase gen types` + Zod | ✅ Prisma types (better DX for complex relations) |
| Migration system | ✅ `supabase migration` | ⚠️ Conflicts with `prisma migrate` — pick one |
| Two migration systems | ✅ None | ❌ High friction |
| Cold-start overhead | ✅ None | ⚠️ Prisma client instantiation adds cold-start time |

---

## Conclusion

**Use Supabase SDK directly. Do not add Prisma.**

For this project specifically:
- RLS is non-negotiable for the security model — Prisma breaks it silently
- Auth, Realtime, and Storage require the Supabase SDK regardless — Prisma doesn't reduce the SDK dependency
- Supabase migrations are already written — adding Prisma introduces a second, conflicting migration system
- The service layer in `shared/api/` provides the same decoupling that Prisma would have offered — if the DB ever changes, only 8 function bodies change
- Vercel + Supabase SDK = no connection pooling problems out of the box

Prisma would be the right call if this project had no RLS, no Realtime, no Auth via Supabase, and needed complex nested queries or DB portability. None of those conditions apply here.

---

## Open Questions

None. This is a resolved architectural decision — proceed with Supabase SDK directly in Phase 4 of the backend implementation.
