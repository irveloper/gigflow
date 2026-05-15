# Plan: Production Hardening Round 2

## Decisions (from spec)

1. **Check-in photo storage**: AWS S3
2. **CSP enforcement mode**: Enforcing `Content-Security-Policy` from day 1
3. **Deactivated user error message**: Generic "invalid credentials" — same as wrong password

---

## Architecture Overview

6 independent changes, ordered by risk and complexity:

1. **`isActive` login bypass** — 1-line fix in `auth.ts` `authorize()`. Returns `null` (generic rejection) when `isActive` is false.
2. **Demo credentials gate** — Wrap the demo card in `{process.env.NODE_ENV !== 'production' && ...}`. Next.js inlines `NODE_ENV` at build time; no runtime cost.
3. **Enforcing CSP** — Add `Content-Security-Policy` to the `headers()` block in `next.config.mjs`. Strategy: `'self'` for most directives, `'unsafe-inline'` for scripts/styles (required for Next.js App Router hydration inline scripts without nonce infrastructure). This is pragmatic — not perfect, but blocks third-party script injection. Nonce-based CSP is an upgrade path documented in comments.
4. **Check-in → DB** — Add a dedicated `events.checkIn` tRPC mutation. The `shared/api/check-in.ts` mock is replaced to call this mutation. Photo upload (S3) is a separate concern handled by a Next.js Route Handler.
5. **Check-in photo → S3** — A dedicated `POST /api/upload/checkin-photo` Route Handler accepts `multipart/form-data`, uploads to S3 with `@aws-sdk/client-s3`, returns the public URL. `shared/api/check-in.ts` calls this endpoint first if a photo is present, then passes the URL to the tRPC mutation.
6. **CI pipeline + BACKEND.md** — GitHub Actions workflow. BACKEND.md rewritten to match the actual stack.

**Data flow for check-in (new):**
```
[Check-in page]
  → submitCheckInFx (Effector)
  → shared/api/check-in.ts submitCheckIn()
      → if photo: POST /api/upload/checkin-photo (multipart)
            → S3 PutObjectCommand → returns S3 URL
      → trpc.events.checkIn.mutate({ eventId, photoUrl?, timestamp, location?, comments? })
            → prisma.event.update({ checkedIn: true, checkInTime, checkInPhoto, ... })
```

---

## Implementation Phases

### Phase 1 — Auth fixes (2 files, ~10 lines)

**Goal**: Deactivated users blocked at login. Demo credentials hidden in production.

#### 1.1 Fix `isActive` check in `auth.ts`
- File: `auth.ts`
- In the `authorize()` callback, after `if (!valid) return null`, add:
  ```ts
  if (!dbUser.isActive) return null
  ```
- No message change — `null` return from `authorize` always produces the same generic NextAuth error.

#### 1.2 Gate demo credentials in login page
- File: `app/auth/login/page.tsx`
- The `demoAccounts` array and its card are already defined. Wrap the Demo Accounts `<Card>` block in:
  ```tsx
  {process.env.NODE_ENV !== 'production' && (
    <Card>...</Card>
  )}
  ```
- `process.env.NODE_ENV` is a compile-time constant in Next.js — the block is tree-shaken in prod builds. Credentials never appear in the bundle or HTML.

---

### Phase 2 — CSP header

**Goal**: All responses include an enforcing `Content-Security-Policy` header.

#### 2.1 Add CSP to `next.config.mjs`
- File: `next.config.mjs`
- Extend the existing `headers()` block (currently has 5 headers) with a 6th entry:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.amazonaws.com; font-src 'self'; connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```
- **Why `'unsafe-inline'` for scripts**: Next.js App Router injects inline `<script>` tags for RSC payload and hydration. Without a nonce infrastructure (middleware + layout changes), `'unsafe-inline'` is required. The real XSS mitigation here is `default-src 'self'` blocking external script loads.
- **Why `'unsafe-eval'`**: Some Next.js internals and the Effector dev tools use `eval` in development. Next.js build output may include it for error overlays. Restrict to non-production via separate `headers()` entry if desired.
- `frame-ancestors 'none'` supersedes `X-Frame-Options: DENY` (both can coexist).
- `connect-src` allows Sentry ingest endpoint for error reporting.
- Add a comment above the CSP value: `// TODO: upgrade to nonce-based CSP to remove 'unsafe-inline'`

---

### Phase 3 — Check-in: tRPC mutation

**Goal**: Check-in data persists to the database.

#### 3.1 Add `checkIn` mutation to events router
- File: `server/routers/events.ts`
- Add after the `delete` mutation:
  ```ts
  checkIn: protectedProcedure
    .input(z.object({
      eventId: z.string(),
      photoUrl: z.string().url().optional(),
      timestamp: z.string().datetime({ offset: true }),
      location: z.object({ lat: z.number(), lng: z.number() }).optional(),
      comments: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.event.findUnique({ where: { id: input.eventId } })
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' })

      const updated = await ctx.prisma.event.update({
        where: { id: input.eventId },
        data: {
          checkedIn: true,
          status: 'in-progress',
          checkInTime: new Date(input.timestamp),
          checkInPhoto: input.photoUrl ?? null,
          checkInLocation: input.location ?? undefined,
          checkInComments: input.comments ?? null,
        },
      })
      return mapEvent(updated)
    }),
  ```
- Access control: `protectedProcedure` (any authenticated user can submit their own check-in). Role enforcement (musician-only) is a future concern.

---

### Phase 4 — Check-in: S3 photo upload

**Goal**: Photos uploaded to AWS S3; real URLs stored in DB.

#### 4.1 Install AWS SDK
```bash
pnpm add @aws-sdk/client-s3
```

#### 4.2 Add S3 env vars
- File: `lib/env.ts` — add to `REQUIRED`:
  ```ts
  const REQUIRED = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_BUCKET"] as const
  ```
  Add to `env` export:
  ```ts
  AWS_REGION: process.env.AWS_REGION!,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET!,
  ```
- File: `.env.local.example` — add:
  ```
  # AWS S3 — check-in photo storage
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=
  AWS_S3_BUCKET=plugin-cancun-checkins
  ```
- File: `.env.local` — add placeholder values (user fills in real ones)
- File: `vitest.config.ts` — add the 4 new vars to the `test.env` stub block (dummy values like `test`)

**NOTE**: Adding S3 env vars to `REQUIRED` in `lib/env.ts` means the app won't start without them. This is correct for production but requires updating the vitest stubs and the CI env block. If S3 should be optional (check-in works without photo storage), keep them out of `REQUIRED` and validate lazily in the upload handler.

**Decision**: Keep in `REQUIRED` — the check-in feature is a core feature and the app should fail loudly if misconfigured. Document in `BACKEND.md`.

#### 4.3 Create S3 upload Route Handler
- File: `app/api/upload/checkin-photo/route.ts` (new)
- Accepts `POST` with `multipart/form-data`, field name `file`
- Auth check: must have session (`auth()` from `@/auth`)
- Upload to S3 with key: `checkins/{userId}/{eventId}/{timestamp}.{ext}`
- Returns `{ url: string }` where `url` is the public S3 URL: `https://{bucket}.s3.{region}.amazonaws.com/{key}`
- Max file size: 10MB (return 413 if exceeded)
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp` (return 415 if not matched)

#### 4.4 Rewrite `shared/api/storage.ts`
- Replace the mock with a real implementation using the Route Handler:
  ```ts
  export async function uploadCheckInPhoto(file: File, userId: string, eventId: string): Promise<UploadResult>
  ```
- Uses `fetch('/api/upload/checkin-photo', { method: 'POST', body: FormData })` internally

#### 4.5 Rewrite `shared/api/check-in.ts`
- Replace `submitCheckIn()`:
  1. If `input.photo` present: call `uploadCheckInPhoto()` from `shared/api/storage.ts` → get `signedUrl`
  2. Call `trpc.events.checkIn.mutate({ eventId, photoUrl: signedUrl, timestamp, location, comments })`
  3. Return `CheckInResult` from the tRPC response
- `confirmCheckIn()` and `rejectCheckIn()`: call `trpc.events.update.mutate()` with status changes

#### 4.6 Update `specs/entities/event.schema.ts` (CheckInInputSchema)
- `photo` field: change from `z.instanceof(File)` to `z.instanceof(File).optional()` since photo is optional
- No other changes — `CheckInInput` type stays the same shape

---

### Phase 5 — CI pipeline

**Goal**: `pnpm test:run` and `pnpm build` run on every push/PR; failures block merge.

#### 5.1 Create GitHub Actions workflow
- File: `.github/workflows/ci.yml` (new directory + file)
- Triggers: `push` to `main`, `pull_request` targeting `main`
- Single job `ci` on `ubuntu-latest`:
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` (version from `.tool-versions` or latest)
  3. `actions/setup-node@v4` with `cache: 'pnpm'`
  4. `pnpm install --frozen-lockfile`
  5. `pnpm test:run`
  6. `pnpm build`
- Environment variables for both steps:
  ```
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
  NEXTAUTH_SECRET: ci-test-secret-not-real
  NEXTAUTH_URL: http://localhost:3000
  NEXT_PUBLIC_SENTRY_DSN: ""
  AWS_REGION: us-east-1
  AWS_ACCESS_KEY_ID: ci-placeholder
  AWS_SECRET_ACCESS_KEY: ci-placeholder
  AWS_S3_BUCKET: ci-placeholder
  ```
- `pnpm build` does not need a real DB — Prisma client is generated from schema (no DB connection at build time with `@prisma/adapter-pg`). Env vars just need to be non-empty for `lib/env.ts` validation.

---

### Phase 6 — BACKEND.md rewrite

**Goal**: Documentation matches the actual stack.

#### 6.1 Rewrite `BACKEND.md`
Replace all Supabase content with accurate descriptions of:
- **Stack**: PostgreSQL (Docker), Prisma ORM, NextAuth v5 (credentials), tRPC v11, `@aws-sdk/client-s3` for storage
- **Local setup**: `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`
- **Environment variables table**: all vars from `.env.local.example` with description
- **Role-based access**: how `managerProcedure`/`musicianProcedure`/`protectedProcedure` enforce roles in tRPC
- **DB migrations**: `prisma migrate dev` (local), `prisma migrate deploy` (prod)
- **S3 setup**: bucket creation, IAM policy for `PutObject` on the bucket

---

## Technical Dependencies

| Dependency | Version | Why |
|------------|---------|-----|
| `@aws-sdk/client-s3` | latest v3 | S3 photo upload from Route Handler |

No other new dependencies. All other changes use existing packages.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| S3 CORS blocks browser upload | Upload goes through the Next.js Route Handler (server-side), not direct browser-to-S3. No CORS config needed on the bucket. |
| CSP `'unsafe-inline'` weakens script protection | Documented limitation. `default-src 'self'` still blocks externally-injected scripts. Nonce upgrade path noted in comments. |
| S3 env vars added to `REQUIRED` breaks existing dev setups | `BACKEND.md` and `.env.local.example` document them. CI stubs use placeholder values. |
| `pnpm build` in CI hits `lib/env.ts` throw | All required env vars stubbed in CI workflow env block. Prisma generates from schema, no DB needed at build time. |
| `photo: z.instanceof(File)` fails in Node.js test env | Tests mock the API layer — `CheckInInputSchema` is not used in unit tests. Route Handler tests (if added) would use FormData. |

---

## Out of Scope

- Nonce-based CSP (requires middleware + layout changes — future upgrade)
- Real-time notifications on check-in (WebSocket / Supabase Realtime)
- Pre-signed S3 URLs for client-direct upload (server-side upload is simpler and sufficient)
- S3 lifecycle rules or bucket versioning
- Email notifications on check-in or deactivation
- Per-user S3 presigned read URLs (photos stored as public-read for simplicity — can restrict later)
- Playwright or Cypress E2E tests in CI
- Deployment pipeline (Vercel auto-deploys on push to main; no additional config needed)
- bcrypt cost factor change
- Health check endpoint
