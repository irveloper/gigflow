# Research: S3 Access Control for Authenticated Users

**Branch**: icaamal/fixes-v1  
**Date**: 2026-05-20  
**Feature**: s3-access-control

---

## Topic

How to restrict S3 file access to authenticated users only — both upload and read — and how to correctly configure the S3 bucket for this app.

---

## Codebase Findings

### Current S3 Implementation

**Client** (`src/lib/s3.ts`):
- Uses `@aws-sdk/client-s3` v3
- `uploadWithRetry()` wraps `PutObjectCommand` with 2-retry exponential backoff (400ms → 800ms)
- Sentry integration on final failure

**Upload endpoint** (`src/app/api/upload/checkin-photo/route.ts`):
- `POST /api/upload/checkin-photo`
- **Auth guard already in place**: calls `auth()` from NextAuth, returns 401 if no session
- Accepts `FormData { file, eventId }`
- Allowed types: `image/jpeg`, `image/png`, `image/webp`; max 10MB server-side
- Generates S3 key: `checkins/{session.user.id}/{eventId}/{timestamp}.{ext}`
- Returns **public S3 URL**: `https://{bucket}.s3.{region}.amazonaws.com/{key}`

**Frontend** (`src/widgets/check-in-form/ui.tsx`):
- Client-side 5MB limit + JPEG/PNG type check
- POSTs FormData to upload endpoint
- Receives URL; submits check-in via tRPC `events.checkIn`

**Database** (`prisma/schema.prisma`):
- `Event.checkInPhoto String?` stores the raw S3 URL

**Middleware** (`src/middleware.ts`):
- CSP allows `img-src *.amazonaws.com` — images embedded via `<img src={s3Url}>`
- Upload endpoint NOT explicitly rate-limited

### Auth Stack

- NextAuth v5, JWT strategy, credentials provider
- `session.user.id`, `session.user.role`, `session.user.organizationId` available
- Protected routes enforced by middleware; upload route enforces auth internally

### Current Security Gap

**The upload is protected; the read is not.**

Objects are stored as permanent, publicly readable S3 URLs. Anyone with the URL (e.g. by inspecting network traffic or a leaked database export) can access check-in photos without authentication. There is no bucket policy blocking public reads, no presigned URLs with expiry, and no CloudFront signed URL layer.

---

## External References

### AWS S3 Access Control Options

| Approach | Auth on read | Complexity | Best for |
|---|---|---|---|
| **Presigned URLs** (S3GetObjectCommand) | Yes, time-limited | Low | API-proxied apps, small teams |
| **CloudFront Signed URLs/Cookies** | Yes, time-limited | Medium | CDN delivery, high scale |
| **API proxy route** | Yes, session-based | Low-Medium | Full server control, no URL leakage |
| **Block Public Access + IAM only** | IAM level only | Low | No direct browser access needed |

### Presigned URL approach (recommended for this app)

- `GetObjectCommand` + `getSignedUrl` from `@aws-sdk/s3-request-presigner`
- Generates a time-limited URL (e.g. 1h) that works without credentials
- Browser fetches directly from S3 — no proxy bandwidth cost
- URL expires, so leakage has bounded impact
- Bucket must have **Block All Public Access** enabled

### Bucket Configuration Required

```
Block all public access: ON (all 4 checkboxes)
Bucket ACL: disabled (ACLs off)
Bucket policy: deny s3:GetObject if not via presigned / IAM role
CORS: only needed if browser uploads directly (not applicable here — server proxies upload)
Versioning: optional but recommended for audit trail
```

### IAM Policy (least privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    }
  ]
}
```
`GetObject` needed for presigned URL generation (IAM user must have it).

---

## Key Insights

1. **Upload is already auth-gated** — no change needed to `POST /api/upload/checkin-photo`. The 401 guard is solid.

2. **Read is the gap** — switching from public URLs to presigned URLs is the primary work. This requires:
   - A new API route: `GET /api/files/[...key]` that checks session, then returns a redirect to a short-lived presigned URL
   - OR: inline presigned URL generation at data-fetch time (e.g. in tRPC `events.getById`)
   - Bucket must be set to block public access

3. **Minimal client changes** — if using the redirect approach, `<img src="/api/files/checkins/...">` replaces `<img src="https://bucket.s3...">`. CSP `img-src` directive needs update (remove `*.amazonaws.com`, add `'self'`).

4. **Database stores key, not full URL** — the clean path forward is to store only the S3 key (`checkins/{userId}/{eventId}/{ts}.jpg`) in `Event.checkInPhoto`, not the full URL. Then generate presigned URLs at read time. This would require a small migration/data update.

5. **No presigner package yet** — `@aws-sdk/s3-request-presigner` is NOT in `package.json`. Must be added.

6. **Existing env vars are correct** — `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` are already validated in `src/lib/env.ts`.

---

## Constraints & Risks

| Constraint | Detail |
|---|---|
| Existing stored URLs | `Event.checkInPhoto` already has full public S3 URLs in DB. Migration needed to convert to keys, or handle both formats transitionally. |
| CSP headers | `src/middleware.ts` CSP `img-src` includes `*.amazonaws.com`. If bucket goes private, browser `<img>` tags pointing to S3 URLs will break. |
| No rate limit on upload | Upload endpoint has no rate limiting; should be added alongside this work. |
| presigner package missing | `@aws-sdk/s3-request-presigner` not installed. |
| Session required for every image load | Presigned URL approach means unauthenticated users (e.g. sharing a photo link externally) cannot view images. Acceptable given the requirement. |
| URL expiry UX | Short-lived presigned URLs will break if page is left open > expiry window. Need reasonable TTL (e.g. 1h) and consider client-side refresh. |

---

## Open Questions

1. **Store key or URL in DB?** Switching to key-only storage is cleaner long-term but requires a migration. Spec should decide: migrate now vs. handle both.

2. **Where to generate presigned URLs?** Options:
   - Dedicated API route (`GET /api/files/[...key]`) — cleanest separation
   - In tRPC resolver at query time — simpler, no extra route
   - In RSC page at render time — works if pages are server components

3. **TTL for presigned URLs?** 1 hour is common. Shorter = more secure; longer = better UX for long sessions.

4. **Should the presigned URL be cached?** Per-request generation adds latency. Could cache in Redis/memory with key = (s3key, userId), TTL = presigned URL TTL.

5. **CORS needed?** Only if browser uploads directly to S3. Current flow proxies through server — no CORS required.

6. **Rate limiting upload?** Out of scope for this ticket but a risk. Consider adding to spec.
