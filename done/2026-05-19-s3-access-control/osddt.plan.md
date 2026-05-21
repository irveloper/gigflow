# Plan: S3 Access Control for Authenticated Users

**Feature**: s3-access-control  
**Date**: 2026-05-20  
**Stack**: Next.js 15 App Router · NextAuth v5 · Prisma · AWS SDK v3 · tRPC · in-memory cache

---

## Architecture Overview

**Core change**: S3 bucket goes private. Read access is gated through a new authenticated API route `GET /api/files/[...key]` that verifies the NextAuth session, generates a time-limited presigned URL (1h TTL), caches it in-memory per `(userId, s3Key)`, and redirects the browser to it. The browser follows the redirect and loads the image directly from S3 using the presigned URL — no proxy bandwidth cost.

**CSP stays the same**: `img-src *.amazonaws.com` is still required because the browser follows the redirect to S3. No CSP change needed.

**Data model change**: `Event.checkInPhoto` changes semantics from storing a full public URL to storing just the S3 object key (e.g. `checkins/{userId}/{eventId}/{ts}.jpg`). No Prisma schema migration — field type stays `String?`. A data migration script converts existing rows.

**Key flow after this change**:
```
Upload:   client → POST /api/upload/checkin-photo (auth ✓) → S3 PutObject → returns { key }
Display:  client renders <img src="/api/files/checkins/..."> 
          → GET /api/files/[...key] checks session (401 if none)
          → checks in-memory cache
          → generates presigned GetObject URL (1h TTL)
          → caches result
          → 302 redirect to presigned S3 URL
          → browser loads image from S3 using presigned URL
```

---

## Technical Dependencies

| Dependency | Status | Action |
|---|---|---|
| `@aws-sdk/client-s3` | Installed (v3.1047.0) | None |
| `@aws-sdk/s3-request-presigner` | **Not installed** | `pnpm add @aws-sdk/s3-request-presigner` |
| NextAuth v5 `auth()` | Installed | None |
| Prisma `Event.checkInPhoto` | Exists (`String?`) | Data migration only |
| AWS IAM credentials | Exist in `env.ts` | No code change; add `s3:GetObject` to IAM policy |

---

## Implementation Phases

### Phase 1 — Install presigner package

**Goal**: Add presigned URL generation capability.

```bash
pnpm add @aws-sdk/s3-request-presigner
```

No other changes in this phase.

---

### Phase 2 — Add `generatePresignedGetUrl` to `src/lib/s3.ts`

**Goal**: Extend the S3 lib with a presigned read function and an in-memory cache.

**Changes to `src/lib/s3.ts`**:

- Add import: `GetObjectCommand` from `@aws-sdk/client-s3`, `getSignedUrl` from `@aws-sdk/s3-request-presigner`
- Add module-level in-memory cache: `Map<string, { url: string; expiresAt: number }>`
  - Key: `${userId}:${s3Key}`
  - Value: `{ url: presignedUrl, expiresAt: Date.now() + TTL_MS }`
  - TTL: 3600 seconds (1 hour), stored as milliseconds for comparison
- Add exported function:

```typescript
export const PRESIGNED_URL_TTL_SECONDS = 3600

// Module-level cache — lives for the lifetime of the server process
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function generatePresignedGetUrl(
  key: string,
  userId: string
): Promise<string> {
  const cacheKey = `${userId}:${key}`
  const cached = presignedUrlCache.get(cacheKey)

  // Return cached URL if it hasn't expired (with 60s buffer)
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.url
  }

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
  })

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_TTL_SECONDS,
  })

  presignedUrlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000,
  })

  return url
}
```

> Cache buffer: check with 60s remaining to avoid returning a URL that expires before the browser can use it.

---

### Phase 3 — New API route `GET /api/files/[...key]`

**Goal**: Authenticated file access gate.

**Create `src/app/api/files/[...key]/route.ts`**:

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { generatePresignedGetUrl } from "@/lib/s3"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key: segments } = await params
  const key = segments.join("/")

  // Only allow access to checkins/ prefix (scope guard)
  if (!key.startsWith("checkins/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const presignedUrl = await generatePresignedGetUrl(key, session.user.id)

  return NextResponse.redirect(presignedUrl, { status: 302 })
}
```

**Why `[...key]` (catch-all)?** The S3 key contains slashes (`checkins/{userId}/{eventId}/{ts}.jpg`). A catch-all segment captures all parts, which are then joined back.

**Why `params` is a Promise?** Next.js 15 App Router: `params` in route handlers is async.

---

### Phase 4 — Update upload endpoint to return key

**Goal**: `POST /api/upload/checkin-photo` returns the S3 key, not a full public URL.

**Change in `src/app/api/upload/checkin-photo/route.ts`**:

Replace the final return:
```typescript
// Before
const url = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
return NextResponse.json({ url })

// After
return NextResponse.json({ key })
```

No other changes to this file.

---

### Phase 5 — Update `src/shared/api/storage.ts`

**Goal**: Client-side upload wrapper handles `{ key }` response and constructs the app-relative URL.

**Full replacement of `uploadCheckInPhoto`**:

```typescript
export type UploadResult = {
  path: string      // S3 key (e.g. checkins/{userId}/{eventId}/{ts}.jpg)
  signedUrl: string // App-relative URL to fetch the image via auth gate
}

export async function uploadCheckInPhoto(file: File, eventId: string): Promise<UploadResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("eventId", eventId)

  const res = await fetch("/api/upload/checkin-photo", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const messages: Record<number, string> = {
      400: "Datos de carga inválidos. Intenta de nuevo.",
      401: "No autorizado. Inicia sesión e intenta de nuevo.",
      413: "La imagen es demasiado grande. Máximo 10MB.",
      415: "Formato de imagen no soportado. Usa JPEG, PNG o WebP.",
      502: "Error al guardar la foto. Intenta de nuevo en unos momentos.",
    }
    throw new Error(messages[res.status] ?? "No se pudo subir la foto. Intenta de nuevo.")
  }

  const { key } = (await res.json()) as { key: string }
  return { path: key, signedUrl: `/api/files/${key}` }
}
```

> `signedUrl` field name kept for compatibility with callers in `src/features/check-in/model.ts` and `src/shared/api/check-in.ts`. The value is now an app-relative URL instead of a direct S3 URL — browsers follow the auth-gated redirect transparently.

---

### Phase 6 — Update UI image rendering

**Goal**: Everywhere `checkInPhoto` is displayed as an `<img>`, the `src` must use `/api/files/` prefix.

**Files to update**:

Find all UI components rendering `checkInPhoto`. Based on grep results, the tRPC router returns `checkInPhoto` to the client. The client stores/displays it.

- In `src/server/routers/events.ts` (line 154): `checkInPhoto: e.checkInPhoto ?? undefined` — this returns the key to the client as-is. No change here; the client must prefix it.
- In any component/widget that renders the photo:
  - Replace `<img src={event.checkInPhoto} ...>` with `<img src={event.checkInPhoto ? \`/api/files/${event.checkInPhoto}\` : undefined} ...>`

> **Note**: If `checkInPhoto` already contains a full URL (pre-migration rows not yet converted), the prefix would break it. Phase 7 (migration) must run before or concurrently with this change. Deploy order: migrate data first, then deploy code.

---

### Phase 7 — Data migration script

**Goal**: Convert existing `Event.checkInPhoto` full URLs to S3 keys.

**Create `scripts/migrate-checkin-photo-to-key.ts`**:

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const events = await prisma.event.findMany({
    where: { checkInPhoto: { not: null } },
    select: { id: true, checkInPhoto: true },
  })

  let updated = 0
  for (const event of events) {
    const photo = event.checkInPhoto!
    // Only convert full S3 URLs — skip if already a key (no "://" present)
    if (!photo.includes("://")) continue

    try {
      const url = new URL(photo)
      // pathname = "/{key}" — strip leading slash
      const key = url.pathname.slice(1)
      await prisma.event.update({
        where: { id: event.id },
        data: { checkInPhoto: key },
      })
      updated++
      console.log(`✓ ${event.id}: ${photo} → ${key}`)
    } catch (err) {
      console.error(`✗ ${event.id}: failed to parse URL "${photo}"`, err)
    }
  }

  console.log(`\nDone. Updated ${updated}/${events.length} rows.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Run with**:
```bash
pnpm tsx scripts/migrate-checkin-photo-to-key.ts
```

> Safe to run multiple times — skips rows that are already keys (no `://`).

---

### Phase 8 — AWS S3 bucket configuration (manual, out-of-code)

**Goal**: Make the bucket private. This is a one-time AWS Console/CLI operation, not a code change.

**Steps**:

1. **Block all public access** (AWS Console → S3 → Bucket → Permissions → Block public access):
   - Block all four checkboxes: ON

2. **Disable bucket ACLs** (Permissions → Object Ownership):
   - Set to "Bucket owner enforced" (disables ACLs)

3. **Remove any public bucket policy** (Permissions → Bucket policy):
   - If there is a statement with `"Principal": "*"` and `"Action": "s3:GetObject"`, remove it.

4. **IAM policy for app user** — ensure the IAM user has both actions (already documented in BACKEND.md, adding `GetObject` needed for presigned URL signing):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject"],
       "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
     }]
   }
   ```

5. **No CORS needed** — uploads are proxied server-side; browsers load images via presigned redirect (same S3 endpoint, no cross-origin preflight needed for `<img>` tags).

---

## Deployment Order

To avoid breaking existing image display during deployment:

```
1. Run migration script (converts existing URLs to keys in DB)
2. Deploy code changes (upload returns key, /api/files/ route live, UI uses /api/files/ prefix)
3. Block public access on S3 bucket
```

Steps 1 and 2 can be swapped if the migration script is guarded (it skips non-URL values, so it's safe to run after code deploy too). Step 3 must be last — blocking public access before code deploy would break existing image rendering.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| In-memory cache lost on server restart/cold start | Presigned URLs regenerated on next request; 1h TTL means users see a brief cache miss but no functional breakage |
| Multiple server instances (e.g. Vercel serverless) | Each instance has its own cache — cache miss rate higher but no correctness issue. Presigned URL generation is fast (~50ms) |
| Migration script fails mid-run | Script is idempotent — safe to re-run. Rows with keys (no `://`) are skipped |
| `checkInPhoto` key contains unexpected format | Scope guard in `/api/files/[...key]`: only keys starting with `checkins/` are allowed. Returns 404 for anything else |
| Presigned URL expiry while user has page open | 1h TTL is generous for typical sessions. If URL expires, image fails to load — user can refresh. No auto-refresh implemented (out of scope) |

---

## Out of Scope

- Role-based read access (only uploader can view their own photos)
- Rate limiting the upload endpoint
- CloudFront CDN layer
- Presigned URLs for uploads (current server-proxy upload stays)
- Redis/Upstash caching (in-memory chosen)
- Automatic presigned URL refresh on the client when TTL expires
