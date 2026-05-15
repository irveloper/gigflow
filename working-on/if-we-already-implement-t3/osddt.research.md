# Research: T3 Stack Implementation Status

**Topic**: Assess whether the T3 stack is fully and correctly implemented in this project.

---

## Codebase Findings

### T3 Stack Components

| Component | Status | Notes |
|-----------|--------|-------|
| **Next.js** | ✅ Done | v16.2.4, App Router, `app/(authenticated)/` route group |
| **TypeScript** | ✅ Done | Strict, Zod schemas as source of truth via `z.infer<>` |
| **Tailwind CSS** | ✅ Done | v4 + shadcn/ui, `components.json` present |
| **tRPC** | ⚠️ Partial | Infrastructure wired, but missing React Query layer and auth integration |
| **Prisma** | ❌ Absent | Replaced by Supabase. Not a gap — intentional divergence from T3 default |
| **NextAuth.js** | ❌ Absent | Using localStorage + cookie auth now; Supabase Auth planned (Phase 3) |

---

### tRPC — What Exists

**Server side (`server/`):**
- `server/trpc.ts` — `initTRPC` with minimal context (`{ req: NextRequest }`)
- `server/routers/events.ts`, `hotels.ts`, `musicians.ts`, `notifications.ts` — all CRUD routers
- `server/routers/index.ts` — `appRouter` merging all routers + `AppRouter` type export
- `app/api/trpc/[trpc]/route.ts` — Next.js fetch handler (`GET`/`POST`)

**Client side:**
- `shared/lib/trpc.ts` — vanilla `createTRPCClient<AppRouter>` with `httpBatchLink` to `/api/trpc`
- `shared/api/events.ts`, `notifications.ts`, etc. — thin wrappers calling `trpc.*.query()`/`trpc.*.mutate()`
- Effector models (`features/*/model.ts`) call `shared/api/*` via `createEffect`

---

### tRPC — What's Missing / Imperfect

1. **No `@trpc/react-query`** — `package.json` only has `@trpc/client` + `@trpc/server`. No `useQuery`/`useMutation` hooks. Using vanilla promise-based client, which is fine for Effector but is non-standard for T3.

2. **No `TRPCProvider` / `QueryClientProvider`** — No React context wrapper anywhere. Effector effects call tRPC directly via promises; this bypasses React Query's caching and deduplication.

3. **No `protectedProcedure`** — All procedures are `publicProcedure`. No auth check at the tRPC layer. Anyone can call any endpoint. The tRPC context (`createTRPCContext`) only passes `req`, not user/session.

4. **Mock data not from `specs/fixtures/`** — Routers import from `shared/mocks/` (e.g., `allEvents` from `shared/mocks/events.ts`). CLAUDE.md mandates: *"Effects that return mock data MUST import from `specs/fixtures/`"*. This is a spec violation.

5. **No real DB in tRPC routers** — Supabase clients exist (`lib/supabase/client.ts`, `lib/supabase/server.ts`) but tRPC routers do not use them. Comments in `shared/api/events.ts` say: `Phase 4: server/routers/events.ts replaced with Supabase queries`.

6. **Auth not integrated** — `shared/api/auth.ts` bypasses tRPC entirely — uses localStorage + cookie directly. No `shared/api/auth.ts` → tRPC path exists at all.

---

### Current Architecture Flow

```
UI (React) → Effector model → shared/api/*.ts → trpc.* (vanilla) → /api/trpc → server/routers → shared/mocks/*
```

Not the canonical T3 flow, which would be:
```
UI → useQuery/useMutation (tRPC React Query hooks) → /api/trpc → server/routers → Prisma/Supabase
```

---

### Supabase Setup

- Migrations in `supabase/migrations/` (tables, RLS, storage bucket)
- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server client (async cookies)
- BACKEND.md describes 4-phase plan: Phase 1 = mock data via tRPC, Phase 3 = Supabase Auth, Phase 4 = tRPC routers → Supabase queries

---

### SDD Compliance Issues Found

- `server/routers/events.ts` imports `allEvents` from `@/shared/mocks/events`, not `@/specs/fixtures/events` — violates CLAUDE.md rule
- Same for `hotels.ts`, `musicians.ts`, `notifications.ts`

---

## External References

- T3 Stack: Next.js + TypeScript + Tailwind + tRPC + Prisma + NextAuth (create.t3.gg)
- This project: Next.js + TypeScript + Tailwind + tRPC (partial) + Supabase (replaces Prisma + NextAuth)

---

## Key Insights

1. **T3 "spirit" is mostly there** — tRPC plumbing works end-to-end (API route + server routers + typed client). The type-safety pipeline (`AppRouter` → `trpc.*` → inferred types) is functional.

2. **Effector replaces React Query** — The choice to use Effector for state management means `@trpc/react-query` is deliberately absent. This is intentional, not a gap.

3. **Phase-based implementation** — The project is mid-flight. Phase 1 (mock data via tRPC) is done. Phase 3 (Supabase Auth) and Phase 4 (Supabase DB queries in tRPC) are not yet started.

4. **Two mock data sources** — `shared/mocks/` and `specs/fixtures/` both exist and likely have the same data. Routers use `shared/mocks/`, violating the SDD rule.

---

## Constraints & Risks

- **No auth guard on tRPC** — All procedures are public. If deployed, any unauthenticated HTTP call to `/api/trpc` succeeds.
- **localStorage auth is browser-only** — `shared/api/auth.ts` will throw in SSR context (`document is not defined`). Guarded by `"use client"` in all pages that call it, but fragile.
- **Mock data divergence** — `shared/mocks/` and `specs/fixtures/` may drift. Only fixtures are guaranteed by SDD.
- **`shared/mocks/users.ts` exposes demo credentials** (`DEMO_PASSWORD`) in the bundle — not a production-ready pattern.

---

## Open Questions

1. **Should tRPC routers switch to `specs/fixtures/` now** (fixing the SDD violation), or wait until Phase 4 replaces them with Supabase queries entirely?
2. **When does Phase 3 (Supabase Auth) start?** Auth is the biggest gap in "T3-completeness".
3. **Will `protectedProcedure` be added before Phase 4**, or is the Supabase RLS layer considered sufficient security?
4. **Is the Effector + vanilla tRPC client architecture settled**, or is there a plan to adopt `@trpc/react-query` hooks alongside Effector?
