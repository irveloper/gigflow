# Tasks: S3 Access Control for Authenticated Users

**Feature**: s3-access-control  
**Date**: 2026-05-20

---

## Dependencies

```
Phase 1 → Phase 2 → Phase 3
Phase 1 → Phase 4 → Phase 5
Phase 7 must run before or alongside Phase 6 (data before code deploy)
Phase 8 must run last (after code deploy)
```

---

## Phase 1 — Install presigner package

- [x] [S] Install `@aws-sdk/s3-request-presigner` via `pnpm add @aws-sdk/s3-request-presigner`

**Definition of Done**: Package appears in `package.json` dependencies and `pnpm-lock.yaml` is updated.

---

## Phase 2 — Extend `src/lib/s3.ts` with presigned URL generation

_Depends on: Phase 1_

- [x] [S] Add `GetObjectCommand` import from `@aws-sdk/client-s3` and `getSignedUrl` import from `@aws-sdk/s3-request-presigner`
- [x] [M] Add module-level `presignedUrlCache` (`Map<string, { url: string; expiresAt: number }>`) and `PRESIGNED_URL_TTL_SECONDS = 3600` constant
- [x] [M] Implement and export `generatePresignedGetUrl(key: string, userId: string): Promise<string>` with 60s cache buffer

**Definition of Done**: `generatePresignedGetUrl` is exported from `src/lib/s3.ts`, uses the in-memory cache (60s buffer before expiry), and generates a presigned `GetObject` URL with 1h TTL.

---

## Phase 3 — Create `GET /api/files/[...key]` route

_Depends on: Phase 2_

- [x] [M] Create `src/app/api/files/[...key]/route.ts` with `GET` handler
- [x] [S] Add NextAuth session check — return 401 if no session
- [x] [S] Add scope guard — return 404 if key does not start with `checkins/`
- [x] [S] Join `params.key` segments, call `generatePresignedGetUrl`, return 302 redirect

**Definition of Done**: 
- Unauthenticated `GET /api/files/checkins/...` returns 401
- Authenticated request returns 302 redirect to a valid presigned S3 URL
- Request for key not starting with `checkins/` returns 404

---

## Phase 4 — Update upload endpoint to return key

_No blocking dependency (can run in parallel with Phase 2/3)_

- [x] [S] In `src/app/api/upload/checkin-photo/route.ts`: remove full URL construction, return `NextResponse.json({ key })` instead of `{ url }`

**Definition of Done**: `POST /api/upload/checkin-photo` response body is `{ key: string }` (e.g. `checkins/{userId}/{eventId}/{ts}.jpg`), not `{ url: string }`.

---

## Phase 5 — Update `src/shared/api/storage.ts`

_Depends on: Phase 4_

- [x] [S] Update `uploadCheckInPhoto` to destructure `{ key }` from response JSON instead of `{ url }`
- [x] [S] Return `{ path: key, signedUrl: \`/api/files/${key}\` }` — preserving the `UploadResult` shape for callers

**Definition of Done**: `uploadCheckInPhoto` returns `{ path: "checkins/...", signedUrl: "/api/files/checkins/..." }`. Existing callers (`check-in/model.ts`) work without changes.

---

## Phase 6 — Update UI image rendering

_Depends on: Phase 7 (migration data must be clean before code deploy)_

- [x] [M] Search codebase for all render sites of `checkInPhoto` (grep for `checkInPhoto` in `src/` excluding routers/schemas)
- [x] [M] For each render site: replace `src={event.checkInPhoto}` with `src={event.checkInPhoto ? \`/api/files/${event.checkInPhoto}\` : undefined}` — no TSX render sites found; updated `check-in.ts` to store S3 key (`path`) instead of app-relative URL (`signedUrl`) in DB

**Definition of Done**: No `<img>` or `<Image>` tag renders `checkInPhoto` directly as a URL. All render sites prefix the value with `/api/files/`.

---

## Phase 7 — Data migration script

_No blocking dependency — run before Phase 6 code is deployed_

- [x] [M] Create `scripts/migrate-checkin-photo-to-key.ts` — queries all events with non-null `checkInPhoto`, skips rows without `://`, extracts S3 key from URL pathname, updates DB row
- [x] [S] Run the script: `pnpm tsx scripts/migrate-checkin-photo-to-key.ts`
- [x] [S] Verify: run script a second time and confirm 0 rows updated (idempotency check)

**Definition of Done**: All `Event.checkInPhoto` values in the database are S3 keys (no `://` present). Script can be re-run safely with 0 updates.

---

## Phase 8 — AWS S3 bucket configuration (manual)

_Depends on: Phase 3, 6, 7 — run after all code is deployed_

- [x] [S] AWS Console: enable "Block all public access" (all 4 checkboxes ON)
- [x] [S] AWS Console: set Object Ownership to "Bucket owner enforced" (disable ACLs)
- [x] [S] AWS Console: remove any bucket policy statement allowing `"Principal": "*"` with `s3:GetObject`
- [x] [S] AWS IAM: confirm app IAM user policy includes both `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::YOUR_BUCKET/*`
- [x] [S] Smoke test: attempt to open a direct S3 URL (`https://bucket.s3.region.amazonaws.com/checkins/...`) — should return Access Denied
- [x] [S] Smoke test: log in to app, navigate to a page with a check-in photo — image should load successfully

**Definition of Done**:
- Direct S3 object URLs return Access Denied (403)
- App image display works for logged-in users
- Unauthenticated access to `/api/files/...` returns 401
