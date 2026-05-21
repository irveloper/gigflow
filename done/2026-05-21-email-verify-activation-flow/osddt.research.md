# Research: Email Verification Activation Flow

## Topic

After registration, a user clicks the email verification link and is redirected back to `/auth/login?verified=1`. They log in but still hit the "pending activation" screen. Only after manually logging out and back in does the flow proceed to org creation and the dashboard. Goal: make the full path — register → verify email → create org → dashboard — seamless with no forced re-login.

---

## Codebase Findings

### 1. Email Verification Route (`src/app/api/auth/verify-email/route.ts`)

- Validates token + email, updates DB: `emailVerified: new Date()`
- Deletes the verification token
- **Clears all auth cookies** (session-token variants) to force a fresh JWT on next login
- Redirects to `/auth/login?verified=1`

Key intent: force re-auth so the new JWT picks up `emailVerified: true`. The implementation is correct in theory but the UX is rough.

### 2. NextAuth Config (`src/auth.config.ts` + `src/auth.ts`)

**`authorize()` callback (`src/auth.ts` ~lines 73-92):**
```typescript
emailVerified: dbUser.emailVerified !== null  // ← boolean conversion, correct
```

**JWT callback (`src/auth.config.ts` ~lines 16-50):**
```typescript
if (user) {
  const u = user as unknown as { emailVerified: boolean; ... }
  token.emailVerified = u.emailVerified  // receives boolean from authorize
}
```

**Session callback (`src/auth.config.ts` ~line 56):**
```typescript
session.user.emailVerified = token.emailVerified as unknown as typeof session.user.emailVerified
```
The `as unknown as` double-cast is suspicious. The session's `emailVerified` type is `Date | null` (NextAuth's built-in User type) while the token carries a `boolean`. This type mismatch means the session might not serialize/deserialize correctly, leaving stale data.

### 3. Middleware (`src/middleware.ts` ~lines 140-158)

- Protected routes: `/`, `/calendar`, `/profile`, `/org`, etc.
- Auth-only routes (redirect if logged in): `/auth/login`, `/auth/register`
- Guard: if `session.user.emailVerified === false` AND NOT on `/auth/pending` → redirect to `/auth/pending?verify=1`
- After org check: org users redirected to `/org/{slug}` prefix

The middleware uses strict `=== false` check, so if `emailVerified` is anything other than a proper `true` boolean (e.g. a Date object, or undefined) it might not redirect correctly in either direction.

### 4. Pending Page (`src/app/auth/pending/page.tsx`)

Dual-mode component:
- `verify=1` param → "Check your inbox" + Resend button (user just registered)
- Default → "Account pending activation" + "Create my organization" button

**Problem**: There's no state machine — the component shows "create org" even if the user hasn't verified email. The pending page conflates two separate states:
1. Email unverified (waiting for click)
2. Email verified but no org yet (ready to create org)

### 5. Org Creation (`src/app/org/new/page.tsx` + `src/app/org/new/actions.ts`)

- `createOrgAction()` requires a valid session (checks `session.user.id`)
- No `emailVerified` guard — unverified users can technically create an org
- On success: calls `unstable_update()` to refresh JWT with `organizationId`, `organizationSlug`, `role`
- Redirects to `/org/{slug}`

### 6. Auth Scenarios (`src/specs/features/auth.scenarios.ts`)

Existing scenarios cover: login, register, logout, org slug routing.

**Missing scenarios:**
- User verifies email → logs in → lands on dashboard (not pending)
- User verifies email → session reflects `emailVerified: true`
- User on pending page: "create org" only shown when email is verified

### 7. Register + Auto-Login Flow (`src/shared/api/auth.ts`, `src/server/routers/auth.ts`)

- Register creates user with `emailVerified: null`
- Auto-calls `signIn("credentials")` after registration
- JWT created with `emailVerified: false` (because `null !== null` is `false` — wait, `null !== null` is `false`, so the expression `dbUser.emailVerified !== null` would be `false`)
- User lands at middleware → redirected to `/auth/pending?verify=1`

---

## Key Insights

### Root Cause (Primary)

The verify-email route correctly clears cookies and forces re-login. After re-login, the `authorize()` callback fetches the user from DB and returns `emailVerified: true` (as boolean). The JWT callback stores this correctly. However, the **session callback** does a double `as unknown as` cast that coerces the boolean into NextAuth's native `Date | null` session type — which can corrupt the value during JSON serialization in the JWT.

The middleware then reads `session.user.emailVerified === false`. If the value was corrupted (e.g. becomes `null` instead of a truthy Date, or the Date string doesn't equal `false`), the guard behaves unexpectedly.

**Why second login works**: After the first "post-verification login" where the session is corrupted, logging out fully destroys the bad JWT. The second login starts fresh — same `authorize()` flow, same DB read, but this time no stale token is present and the JWT is built cleanly.

### UX Flow Problems (Secondary)

Even if the session bug is fixed, the UX has structural issues:

1. User clicks verify link → sees login page → must enter credentials again (forced re-auth)
2. After login, no clear indicator "you're verified, now create your org"
3. Pending page dual-mode is confusing: "create org" button shown in verify=1 mode when user hasn't verified yet, OR the wrong mode is shown after verification

### Ideal Flow

```
Register → auto-login → /auth/pending?verify=1 (check inbox)
       ↓
Click email link → session updated → redirect to /auth/pending (create org mode) OR /org/new directly
       ↓
Create org → /org/{slug} (dashboard)
```

The key UX improvement: after clicking the verification link, instead of forcing a re-login, **auto-transition** the user to the org creation step. This requires either:
- (A) If user is already logged in when clicking the link: update the session in-place via `unstable_update()` and redirect to `/org/new` or `/auth/pending` with no verify param
- (B) If user is not logged in: redirect to login, then after login skip the pending/verify screen and go straight to org creation

---

## External References

- NextAuth `unstable_update()` — used in `src/app/org/new/actions.ts` to refresh JWT mid-session; same mechanism can update `emailVerified` after verification
- NextAuth session callback type mismatch: the built-in `User.emailVerified` is `Date | null` but the project treats it as `boolean` throughout
- CLAUDE.md SDD rules: schema first → fix `specs/entities/` if `emailVerified` type needs changing
- Auth scenarios: `src/specs/features/auth.scenarios.ts` needs new scenarios before implementing

---

## Constraints & Risks

| Constraint | Detail |
|---|---|
| `emailVerified` type conflict | NextAuth native type is `Date \| null`; project uses `boolean` in JWT/session. Changing this touches `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`, and possibly `shared/types`. |
| `unstable_update()` API | Marked unstable — may break on NextAuth upgrade, but it's already used in the codebase (acceptable risk). |
| SDD rules | Must update `specs/entities/` if the type representation changes; cannot manually add types. |
| No email-verify scenarios | Adding test coverage is required before implementation per CLAUDE.md workflow. |
| Cookie clearing on verify | Current approach (clear cookies → force re-login) works but creates bad UX. Changing to in-place update requires the user to still be logged in when clicking the link, which isn't always true. |
| Pending page dual-mode | Refactoring the pending page to separate concerns could affect the invite acceptance flow (`src/app/auth/accept-invite/page.tsx`). |

---

## Open Questions

1. **Should we keep the forced re-login approach or switch to in-place session update?**
   - In-place update (via `unstable_update()`) is cleaner UX but only works when the user is still logged in when they click the link.
   - If they open the link in a different browser or after session expiry, re-login is unavoidable.
   - Hybrid: detect if session exists → update in place; if not → force login then skip pending verification screen.

2. **Is `emailVerified` in session a boolean or Date?**
   - The project treats it as `boolean` everywhere except at the NextAuth type boundary.
   - Should we fix the session callback to explicitly cast `token.emailVerified as boolean` and augment the NextAuth session type accordingly?

3. **Should org creation require verified email?**
   - Currently no guard. Invited musicians bypass verification entirely (their `emailVerified` is set on invite acceptance). Adding a guard would block this path unless musicians are excluded.

4. **What happens on the pending page when `verify=1` and the user is already verified?**
   - If they bookmarked `/auth/pending?verify=1`, they'd see "check your inbox" even after verifying.
   - Should we redirect verified users with an org straight to `/org/{slug}`?

5. **Spec scenarios to add before implementation:**
   - `user verifies email while still logged in → session updates → redirect to /org/new`
   - `user verifies email while logged out → login → redirect to /org/new (skip pending verify)`
   - `pending page shows create-org mode only when email is verified`
