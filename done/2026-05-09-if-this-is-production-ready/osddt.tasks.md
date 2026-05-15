# Tasks: Production Hardening

> Feature: if-this-is-production-ready
> Plan: osddt.plan.md

---

## Phase 1 — Build integrity & test reliability

**DoD**: `pnpm build` exits 0. `pnpm test:run` exits 0. No `@ts-ignore` or error suppressions added.

- [x] [S] `next.config.mjs`: remove `typescript: { ignoreBuildErrors: true }`
- [x] [S] `components/ui/resizable.tsx`: fix `PanelGroup`/`PanelResizeHandle` → `Group`/`Separator` (react-resizable-panels v4 API change)
- [x] [S] `package.json`: remove `@types/bcryptjs` from devDependencies (bcryptjs 3.x ships own types)
- [x] [S] `vitest.config.ts`: stub required env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`) via `test.env` so `lib/env.ts` does not throw in test env
- [x] [M] `__tests__/features/auth.test.ts`: replace localStorage/cookie mocks with `vi.mock("@/auth")` + `vi.mock("next-auth/react")`; use `fork({ handlers })` pattern; add `$isPending` scenario
- [x] [S] `__tests__/features/hotels.test.ts` + `musicians.test.ts`: add type imports, annotate handler params to fix implicit `any` TS errors

---

## Phase 2 — Server-side route protection

**DoD**: GET `/` with no session cookie returns 307 to `/auth/login`.

- [x] [S] `proxy.ts` → `middleware.ts` — renamed; export renamed from `proxy` to `middleware`

---

## Phase 3 — Access control

**DoD**: POST `/api/trpc/auth.register` with `role: "manager"` returns `FORBIDDEN`. Manager not selectable in register UI. `/admin/users` page functional.

- [x] [S] `app/auth/register/page.tsx`: remove `<SelectItem value="manager">` + update `role` type to `"musician" | "hotel" | ""`
- [x] [S] `server/routers/auth.ts`: add `if (input.role === "manager") throw new TRPCError({ code: "FORBIDDEN" })` in register mutation
- [x] [M] `server/routers/admin.ts`: new router — `listUsers`, `createUser`, `deactivateUser` all behind `managerProcedure`; self-deactivation guarded
- [x] [S] `server/routers/index.ts`: add `admin: adminRouter`
- [x] [L] `app/(authenticated)/admin/users/page.tsx`: user table + "Create User" dialog (all roles) + deactivate action

---

## Phase 4 — Security headers + rate limiting

**DoD**: `curl -I /` shows `X-Frame-Options: DENY`. 11th login attempt within 15 min returns 429.

- [x] [S] `next.config.mjs`: add `headers()` — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`
- [x] [M] `middleware.ts`: module-scope `Map` rate limiter; `/api/auth/callback/credentials` 10/15min, `/api/trpc/auth.register` 5/1hr per IP; 429 + `Retry-After` on exceed

---

## Phase 5 — Error tracking (Sentry)

**DoD**: tRPC handler throw captured in Sentry. Client gets `INTERNAL_SERVER_ERROR`, not stack trace.

- [x] [S] `pnpm add @sentry/nextjs`
- [x] [M] `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — `Sentry.init({ dsn, enabled: prod only })`
- [x] [S] `next.config.mjs`: wrap with `withSentryConfig(nextConfig, { silent: true, hideSourceMaps: true })`
- [x] [S] `.env.local.example`: add `NEXT_PUBLIC_SENTRY_DSN=`, `SENTRY_DSN=`, `SENTRY_AUTH_TOKEN=`
- [x] [S] `app/api/trpc/[trpc]/route.ts`: add `onError` → `Sentry.captureException` for `INTERNAL_SERVER_ERROR` only

---

## Phase 6 — Error UI

**DoD**: `/nonexistent` shows branded 404. Client component throw shows branded error page.

- [x] [M] `app/error.tsx`: client component — branded card, `useEffect` Sentry capture, "Try again" + "Go home"
- [x] [S] `app/not-found.tsx`: server component — branded 404, "Go home" to `/`

---

## Phase 7 — Operational

**DoD**: `pnpm db:migrate` and `pnpm db:seed` run clean. Build has no `unoptimized: true`.

- [x] [S] `next.config.mjs`: remove `images: { unoptimized: true }`
- [x] [S] `package.json`: add `db:migrate`, `db:seed` scripts + `"prisma": { "seed": "tsx prisma/seed.ts" }`
- [x] [S] `pnpm add -D tsx`
- [x] [M] `prisma/seed.ts`: idempotent upsert — 1 manager, 2 musicians, 1 hotel user, hotel+musician domain records, 2 events, 1 notification

---

## Dependency order

```
Phase 1 (build/tests) ✅
  ├── Phase 2 (rename middleware) ✅
  │     └── Phase 4 (rate limiting) ✅
  ├── Phase 3 (access control) ✅
  ├── Phase 5 (Sentry) ✅
  │     └── Phase 6 (error UI) ✅
  └── Phase 7 (ops) ✅
```
