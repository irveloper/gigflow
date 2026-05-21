# Spec: S3 Access Control for Authenticated Users

**Feature**: s3-access-control  
**Date**: 2026-05-20  
**Branch**: icaamal/fixes-v1

---

## Overview

Check-in photos uploaded by musicians are currently stored in S3 as permanently public files. Any person who obtains the URL — through network inspection, a database leak, or a shared link — can view these photos without logging in. This is a privacy and security gap that contradicts the requirement that S3 content be accessible only to logged-in users.

This feature closes that gap by ensuring all S3 objects are private and access is granted only to authenticated users of the app, using time-limited access mechanisms.

---

## Session Context

The user's core requirement: **S3 content must only be accessible to logged-in users**. The user also wants guidance on how to configure the S3 bucket correctly for this setup. Research confirmed the upload side is already protected; only the read side needs to change.

---

## Research Summary

- **Upload already protected**: `POST /api/upload/checkin-photo` requires a valid session and returns 401 otherwise. No changes needed here.
- **Read is unprotected**: `Event.checkInPhoto` stores full, permanent public S3 URLs. The bucket does not block public access, so any URL holder can view images.
- **Database schema**: `Event.checkInPhoto` currently stores the full S3 URL. Migrating to store only the object key is the cleaner path, enabling presigned URL generation at read time.
- **CSP impact**: `src/middleware.ts` allows `img-src *.amazonaws.com`. Once bucket is private, this must change.
- **No presigner package**: `@aws-sdk/s3-request-presigner` is not yet installed.

---

## Requirements

### R1 — Private bucket
The S3 bucket must not allow any public object reads. Objects must be inaccessible via direct URL without AWS credentials or a valid presigned URL.

### R2 — Authenticated read access
A logged-in user can view check-in photos. An unauthenticated request to view a photo must be rejected.

### R3 — Time-limited access URLs
Photo URLs surfaced to the browser must expire. A URL obtained by an authenticated user must not work indefinitely if shared or leaked.

### R4 — Transparent UX
A logged-in user viewing a page with check-in photos sees the images load normally. The access control mechanism is invisible to the user during a normal session.

### R5 — Upload behaviour unchanged
The upload flow (selecting a photo in check-in form → uploading → photo associated with event) works exactly as before. No change to upload UX.

### R6 — Existing data compatibility
Events that already have a stored photo reference continue to display their photo correctly after the change.

---

## Scope

### In scope
- Making the S3 bucket private (no public read)
- Replacing public S3 URLs with a mechanism that requires authentication to produce a working image URL
- Updating how photo references are stored or resolved so that read access checks session
- S3 bucket configuration documentation/guidance (IAM policy, block public access settings)

### Out of scope
- Changing who can upload (auth guard already exists and is sufficient)
- Role-based read restrictions (e.g. only the musician who uploaded can view — all logged-in users may view for now)
- Rate limiting the upload endpoint (separate concern)
- CloudFront or CDN layer
- Sharing photos publicly (external links intentionally break — that is the desired behaviour)

---

## Acceptance Criteria

**AC1** — A direct S3 object URL (e.g. `https://bucket.s3.region.amazonaws.com/checkins/...`) returns an access-denied error, not the image.

**AC2** — A logged-in user navigating to a page that displays a check-in photo sees the image load successfully.

**AC3** — An unauthenticated request to access a check-in photo (via the app's access mechanism) returns a 401 or redirect to login.

**AC4** — A photo URL that was valid during an authenticated session stops working after its expiry window, even if the user is still logged in.

**AC5** — Events with photos uploaded before this change continue to display their photos correctly for logged-in users after the change is deployed.

**AC6** — The upload flow (`POST /api/upload/checkin-photo`) continues to return success for authenticated users and 401 for unauthenticated requests, unchanged.

---

## Decisions

1. **DB migration timing**: Migrate now — store only the S3 object key in `Event.checkInPhoto`, not the full URL. Include a data migration script.
2. **Where presigned URLs are generated**: Dedicated API route `GET /api/files/[...key]` — checks session, then redirects to a presigned S3 URL.
3. **Presigned URL TTL**: 1 hour.
4. **Caching presigned URLs**: Cache per (s3-key, userId) with TTL matching the presigned URL TTL (1 hour).
