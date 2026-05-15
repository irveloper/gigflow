# Plan: Production Hardening

## Decisions (from open questions)

| # | Question | Decision |
|---|----------|----------|
| 1 | Manager registration | Admin panel only — managers created by existing managers via `/admin/users`. DB seed for bootstrap. Self-registration blocked at both UI and server. |
| 2 | Deployment platform | Vercel |
| 3 | Error tracking | Sentry (`@sentry/nextjs`) for all server errors |
| 4 | TypeScript strictness | Fix all pre-existing type errors — no suppressions, full strict compliance |

---

## Architecture Overview

All 10 spec requirements map to isolated, non-overlapping changes. No architectural shifts — this is config, ops, and access control work.

**Rate limiting strategy**: In-process `Map` in Next.js middleware (module scope). Acceptable for Vercel single-region deployments; resets on cold starts which is acceptable for MVP. Each Vercel instance maintains its own window. Document upgrade path to Upstash KV for multi-region.

**Sentry wiring**: `@sentry/nextjs` SDK auto-instruments Next.js. tRPC `onError` calls `Sentry.captureException`. All config via environment variables — no hardcoded DSN.

**Admin user management**: New tRPC router `admin.createUser` protected by `managerProcedure`. New page `/admin/users` in the existing admin section. Manager can create accounts for any role including manager.

---

## Implementation Phases

### Phase 1 — Build integrity & test reliability

**Goal**: `pnpm build` and `pnpm test:run` both pass cleanly.

#### 1.1 Remove `ignoreBuildErrors`
- `next.config.mjs`: delete `typescript: { ignoreBuildErrors: true }`

#### 1.2 Fix pre-existing TypeScript errors
- `components/ui/resizable.tsx`: likely missing `React` namespace import — add `import * as React from "react"` or use explicit type annotation
- Test files: remove obsolete `localStorage`/`document.cookie` mocks from `__tests__/features/auth.test.ts`

#### 1.3 Remove deprecated / dead code
- `package.json`: remove `@types/bcryptjs` from devDependencies (bcryptjs 3.x ships own types)
- Delete `shared/api/base.ts` (dead — `NEXT_PUBLIC_API_URL` referenced but file unused)

#### 1.4 Fix vitest env setup
- `vitest.setup.ts`: add `process.env.DATABASE_URL = "postgresql://test"`, `process.env.NEXTAUTH_SECRET = "test-secret"`, `process.env.NEXTAUTH_URL = "http://localhost:3000"` before any imports execute
- `vitest.config.ts`: add `env` block or use `setupFiles` order guarantee (env vars must be set before `lib/env.ts` is imported)
  - Preferred: add `environmentOptions` or use `vi.stubEnv` in setup file

#### 1.5 Rewrite auth model tests
- `__tests__/features/auth.test.ts`: replace localStorage/cookie mocks with NextAuth mocks
- Mock `next-auth/react` at module level: mock `signIn`, `signOut`, `getSession`
- Test scenarios:
  - `loginSubmitted` with valid credentials → `signIn` called → `$user` populated
  - `loginSubmitted` with wrong password → `signIn` returns `{ error: ... }` → `$authError` set
  - `logout` → `signOut` called → `$user` null
  - `checkAuthFx` when session has no role → `$isPending` true

---

### Phase 2 — Server-side route protection

**Goal**: Unauthenticated requests to protected routes get 307 redirect before any HTML renders.

#### 2.1 Rename `proxy.ts` → `middleware.ts`
- `mv proxy.ts middleware.ts` at repo root
- No code changes needed inside — logic, cookie names, and matcher are already correct
- Verify `config.matcher` excludes static/image paths (already done)

---

### Phase 3 — Access control

**Goal**: Manager role cannot be self-assigned. Admin panel is the only creation path.

#### 3.1 Remove manager from registration form
- `app/auth/register/page.tsx`:
  - Remove `<SelectItem value="manager">Gerente</SelectItem>`
  - Update `formData.role` type: `"musician" | "hotel" | ""`
  - Update `onValueChange` handler type accordingly

#### 3.2 Server-side enforcement (defense in depth)
- `server/routers/auth.ts` `register` mutation: add check `if (input.role === "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Manager accounts must be created by an administrator." })`

#### 3.3 Admin user management — tRPC router
- `server/routers/admin.ts`: new router
  - `createUser` mutation — `managerProcedure`
    - Input: `{ name, email, password, role: "musician" | "hotel" | "manager", phone?, ... }`
    - Bcrypt hash password, `prisma.user.create`
    - Reuse `RegisterInputSchema` from `entities/user/schema.ts` (extend or add `adminRegisterSchema`)
  - `listUsers` query — `managerProcedure`
    - Returns all users with `{ id, name, email, role, isActive, createdAt }`
  - `deactivateUser` mutation — `managerProcedure`
    - `prisma.user.update({ where: { id }, data: { isActive: false } })`
- `server/routers/index.ts`: add `admin: adminRouter`

#### 3.4 Admin users page
- `app/(authenticated)/admin/users/page.tsx`:
  - List all users in a table
  - "Create User" button opens a dialog with name/email/password/role fields
  - All roles selectable (including manager) — manager-only page
  - "Deactivate" action per row

---

### Phase 4 — Security headers + rate limiting

**Goal**: All responses include baseline headers. Auth endpoints reject after burst threshold.

#### 4.1 Security headers
- `next.config.mjs`: add `headers()` async function returning:
  ```
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-DNS-Prefetch-Control: off
  ```
  Apply to `source: "/(.*)"` (all routes)

#### 4.2 Rate limiting in middleware
- `middleware.ts`: add in-process rate limiter using module-scope `Map<string, { count: number; resetAt: number }>`
- Rate limit rules:
  - `/api/auth/callback/credentials` (login): 10 attempts per 15 minutes per IP
  - `/api/trpc/auth.register` (registration): 5 attempts per hour per IP
- IP extraction: `request.ip ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"`
- On limit exceeded: return `NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "900" } })`
- Rate limiter runs before auth check in middleware

---

### Phase 5 — Error tracking (Sentry)

**Goal**: All server errors captured in Sentry. Clients receive generic responses.

#### 5.1 Install Sentry
- `pnpm add @sentry/nextjs`
- Run `npx @sentry/wizard@latest -i nextjs` or manually create config files

#### 5.2 Sentry config files
- `sentry.client.config.ts`: initialize with `NEXT_PUBLIC_SENTRY_DSN`
- `sentry.server.config.ts`: initialize with `SENTRY_DSN` (server-side)
- `sentry.edge.config.ts`: initialize for edge runtime (used by middleware)
- `next.config.mjs`: wrap with `withSentryConfig(nextConfig, { ... })`

#### 5.3 Env vars
- Add to `.env.local.example`: `NEXT_PUBLIC_SENTRY_DSN=`, `SENTRY_DSN=`, `SENTRY_AUTH_TOKEN=`
- Add to `lib/env.ts`: validate `SENTRY_DSN` presence in production (optional in dev)

#### 5.4 tRPC onError handler
- `app/api/trpc/[trpc]/route.ts`: add `onError({ error, type, path }) { Sentry.captureException(error, { tags: { trpcPath: path, trpcType: type } }) }`
- Verify tRPC default behavior: non-`TRPCError` exceptions already return `INTERNAL_SERVER_ERROR` code to client without stack trace in production

---

### Phase 6 — Error UI

**Goal**: Users see branded pages on errors and 404s.

#### 6.1 `app/error.tsx`
- React error boundary (`"use client"`)
- Props: `{ error: Error & { digest?: string }; reset: () => void }`
- Branded card with PlugIn Cancún header, error message, "Try again" button (calls `reset()`), "Go home" link
- Report error to Sentry: `useEffect(() => Sentry.captureException(error), [error])`

#### 6.2 `app/not-found.tsx`
- Server component (no `"use client"`)
- Branded 404 page with PlugIn Cancún header, "Page not found" message, "Go home" link to `/`

---

### Phase 7 — Operational

**Goal**: DB setup is scriptable. Images are optimized.

#### 7.1 DB scripts
- `package.json` scripts:
  - `"db:migrate": "prisma migrate deploy"`
  - `"db:seed": "prisma db seed"`
- `prisma/seed.ts`:
  - Import fixtures from `specs/fixtures/`
  - Create 1 manager user, 2 musician users, 1 hotel user (bcrypt-hashed passwords)
  - Create sample events, notifications
  - Use `prisma.upsert` to be idempotent
- `package.json`: add `"prisma": { "seed": "tsx prisma/seed.ts" }`
- Install `tsx` as devDependency if not present

#### 7.2 Image optimization
- `next.config.mjs`: remove `images: { unoptimized: true }`

---

## Technical Dependencies

| Package | Purpose | Action |
|---------|---------|--------|
| `@sentry/nextjs` | Error tracking | Install |
| `tsx` | Run seed script | Install (devDep) |
| `@types/bcryptjs` | Deprecated types | Remove |

No new runtime dependencies beyond Sentry. Rate limiting is in-process (no Upstash/Redis required for MVP).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Removing `ignoreBuildErrors` surfaces unknown TS errors beyond resizable.tsx | Run `pnpm tsc --noEmit` before Phase 1 to inventory all errors upfront |
| In-process rate limiter resets on Vercel cold starts | Acceptable for MVP; document upgrade path to Upstash KV. Each warm instance still enforces within its window. |
| Sentry `withSentryConfig` wrapping modifies webpack config — may conflict | Use `silent: true` + `hideSourceMaps: true` options; test build locally before deploy |
| Seed script using `tsx` requires prisma client to be generated | Add `prisma generate` step before seed in CI docs |
| `proxy.ts` rename may leave IDE imports unresolved briefly | Rename via git mv — no imports reference proxy.ts directly |
| Admin `createUser` bypasses the pending-role guard | Not a bug — admin creates fully-provisioned accounts. pending guard is for self-registered users only. |

---

## Out of Scope

- Check-in and photo storage (Phase 5 — deferred)
- Full Content-Security-Policy (requires asset inventory — separate spike)
- CI/CD pipeline (`.github/workflows/`) — separate infra decision
- Email verification for new accounts
- Password reset flow
- Multi-region rate limiting (Upstash KV upgrade path documented, not implemented)
- Vercel Edge Config or Vercel Firewall rules
