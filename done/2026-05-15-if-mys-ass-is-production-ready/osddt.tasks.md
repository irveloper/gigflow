# Tasks: Production Hardening Round 2

> Feature: if-mys-ass-is-production-ready
> Plan: osddt.plan.md

---

## Phase 1 — Auth fixes

**DoD**: Deactivated user with correct password returns same error as wrong password. Demo card absent from login page HTML in production build.

- [x] [S] `auth.ts`: add `if (!dbUser.isActive) return null` after password verify in `authorize()`
- [x] [S] `app/auth/login/page.tsx`: wrap Demo Accounts `<Card>` in `{process.env.NODE_ENV !== 'production' && (...)}` 

---

## Phase 2 — CSP header

**DoD**: `curl -I http://localhost:3000` response includes `Content-Security-Policy` header with `default-src 'self'`.

- [x] [S] `next.config.mjs`: add `Content-Security-Policy` header to existing `headers()` block — `default-src 'self'`, `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob: https://*.amazonaws.com`, `font-src 'self'`, `connect-src 'self' https://*.ingest.sentry.io`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`
- [x] [S] `next.config.mjs`: add comment above CSP value: `// TODO: upgrade to nonce-based CSP to remove 'unsafe-inline'`

---

## Phase 3 — Check-in tRPC mutation

**DoD**: POST to `trpc.events.checkIn` with valid eventId sets `checkedIn=true` and `checkInTime` in DB. Verified via `prisma.event.findUnique` after call.

- [x] [M] `server/routers/events.ts`: add `checkIn` mutation — `protectedProcedure`, input `{ eventId, photoUrl?, timestamp, location?, comments? }`, updates event row: `checkedIn: true`, `status: 'in-progress'`, `checkInTime`, `checkInPhoto`, `checkInLocation`, `checkInComments`

---

## Phase 4 — S3 photo upload

**DoD**: Check-in with photo stores real S3 URL in `event.checkInPhoto`. Mock storage URLs (`mock-storage.local`) never appear. App starts without S3 vars → throws with clear message.

- [x] [S] `pnpm add @aws-sdk/client-s3`
- [x] [S] `lib/env.ts`: add `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` to `REQUIRED` array and `env` export
- [x] [S] `.env.local.example`: add S3 vars block with comments
- [x] [S] `.env.local`: add S3 placeholder vars (user fills real values)
- [x] [S] `vitest.config.ts`: add 4 new S3 vars to `test.env` stub block (dummy strings)
- [x] [M] `app/api/upload/checkin-photo/route.ts` (new file): POST handler — auth check via `auth()`, parse `multipart/form-data`, validate MIME type (`image/jpeg|png|webp`) + size (≤10MB), upload to S3 with `PutObjectCommand`, return `{ url: string }`
- [x] [M] `shared/api/storage.ts`: replace mock with real impl — `uploadCheckInPhoto(file, userId, eventId)` calls `/api/upload/checkin-photo` via fetch + FormData, returns `UploadResult`
- [x] [M] `shared/api/check-in.ts`: replace mock `submitCheckIn()` — if photo present call `uploadCheckInPhoto()`, then call `trpc.events.checkIn.mutate()`, return result; update `confirmCheckIn()`/`rejectCheckIn()` to call `trpc.events.update.mutate()`
- [x] [S] `entities/event/schema.ts`: `CheckInInputSchema` — change `photo: z.instanceof(File)` to `z.instanceof(File).optional()`

---

## Phase 5 — CI pipeline

**DoD**: Push to `main` triggers GitHub Actions job. `pnpm test:run` and `pnpm build` both run. Failed test blocks merge.

- [x] [S] Create `.github/workflows/` directory
- [x] [M] `.github/workflows/ci.yml` (new file): trigger on `push`+`pull_request` to `main`, single job `ci` on `ubuntu-latest` — checkout, pnpm setup, node setup with cache, `pnpm install --frozen-lockfile`, `pnpm test:run`, `pnpm build`; env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SENTRY_DSN=""`, all 4 S3 vars as placeholders

---

## Phase 6 — BACKEND.md rewrite

**DoD**: `BACKEND.md` contains zero Supabase references. New developer can follow it to run the app locally.

- [x] [M] `BACKEND.md`: full rewrite — describe actual stack (Prisma, NextAuth, tRPC, PostgreSQL via Docker, S3); local setup steps (`docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`); env vars table; role-based access (tRPC procedure guards); S3 bucket setup instructions; migration workflow

---

## Dependencies

```
Phase 1 (auth fixes)      — no deps
Phase 2 (CSP)             — no deps
Phase 3 (checkIn mutation) — no deps
Phase 4 (S3 upload)        — Phase 3 must complete first (checkIn mutation needed by shared/api/check-in.ts rewrite)
Phase 5 (CI)               — Phase 4 must complete first (needs final env var list)
Phase 6 (BACKEND.md)       — Phase 4 must complete first (S3 setup steps needed)
```
