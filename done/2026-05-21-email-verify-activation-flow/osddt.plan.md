# Plan: Email Verification Activation Flow

## Architecture Overview

The root cause is a JWT/session type mismatch in `src/auth.config.ts`: the session callback stores `emailVerified` using `as unknown as typeof session.user.emailVerified`, which coerces a `boolean` into NextAuth's native `Date | null` type — corrupting the value on serialization. The middleware's strict `=== false` check then misfires, bouncing verified users back to the pending screen on their first login after clicking the link.

On top of the bug fix, we add two UX improvements:
1. **Logged-in path**: after clicking the verify link, update the JWT in-place via `unstable_update()` and skip re-authentication entirely.
2. **Logged-out path**: redirect post-verification login to `/auth/pending` (create-org mode) via the existing `from` param mechanism the middleware already handles.

The pending page is also refactored to derive its mode from **actual session state** rather than URL params, eliminating the stale-screen problem. A shared `ActivationStepper` component threads the three-step progress indicator through both the pending page and `/org/new`.

No new dependencies required. All state changes go through existing patterns (`unstable_update()`, `useSession()`).

---

## Implementation Phases

### Phase 0 — Spec scenarios (SDD pre-req)

**Goal**: Add missing test scenarios before touching any implementation code (per CLAUDE.md workflow).

**File**: `src/specs/features/auth.scenarios.ts`

Add a new top-level key `emailVerification` with these scenarios:

```
emailVerification: {
  "verified user logs in — session has emailVerified true": { ... }
  "verified user visits /auth/pending — sees create-org mode not inbox": { ... }
  "unverified user visits /org/new — redirected to /auth/pending?verify=1": { ... }
  "logged-in user clicks verify link — session refreshed, redirected to /auth/pending": { ... }
  "logged-out user clicks verify link — redirected to login with from=/auth/pending": { ... }
}
```

Add a matching fixture to `src/specs/fixtures/users.ts` if a `verifiedNoOrg` user fixture doesn't already exist (user with `emailVerified: true`, `organizationId: null`).

---

### Phase 1 — Fix the session type bug (root cause)

**Goal**: `session.user.emailVerified` is reliably a `boolean` everywhere.

#### Step 1a — Fix NextAuth type augmentation

Find the NextAuth type declaration file (search for `declare module "next-auth"`). The `User` and `Session` interfaces need `emailVerified: boolean` (not `Date | null`). This removes the need for the double-cast.

Look for this file at paths like:
- `src/types/next-auth.d.ts`
- `src/types/index.d.ts`
- `src/auth.d.ts`

Add or update:
```typescript
declare module "next-auth" {
  interface Session {
    user: {
      // ... existing fields ...
      emailVerified: boolean
    }
  }
  interface User {
    emailVerified: boolean
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    emailVerified: boolean
    // ... other custom fields ...
  }
}
```

#### Step 1b — Fix session callback (`src/auth.config.ts` line 56)

Change:
```typescript
session.user.emailVerified = token.emailVerified as unknown as typeof session.user.emailVerified
```
To:
```typescript
session.user.emailVerified = Boolean(token.emailVerified)
```

#### Step 1c — Add `emailVerified` to the JWT update handler (`src/auth.config.ts` lines 10-14)

The `trigger === "update"` block currently only propagates org fields. Add:
```typescript
if (s.user?.emailVerified !== undefined) token.emailVerified = s.user.emailVerified
```
This enables `unstable_update({ user: { emailVerified: true } })` to actually take effect.

---

### Phase 2 — Update the verify-email route

**File**: `src/app/api/auth/verify-email/route.ts`

**Goal**: Logged-in users skip re-authentication; logged-out users land in the right place after login.

After the DB transaction (line 37), branch on session presence:

```
const sessionCookie =
  request.cookies.get("authjs.session-token") ??
  request.cookies.get("__Secure-authjs.session-token") ??
  ...

if (sessionCookie) {
  // User is logged in — update JWT in-place, skip re-auth
  await unstable_update({ user: { emailVerified: true } })
  return NextResponse.redirect(new URL("/auth/pending", request.url))
} else {
  // User not logged in — force fresh JWT on next login
  const redirectResponse = NextResponse.redirect(
    new URL("/auth/login?verified=1&from=/auth/pending", request.url)
  )
  // clear cookies (existing code)
  ...
  return redirectResponse
}
```

Note: `unstable_update()` must be imported from `@/auth`. Verify that it correctly sets the updated JWT cookie on the response when called from a Route Handler. If the cookie is not set (i.e., the redirect response doesn't carry the updated token), fall back to: redirect to `/auth/login?verified=1&from=/auth/pending` for both paths and rely on Phase 1's bug fix to ensure the next login creates a correct JWT.

---

### Phase 3 — Refactor the pending page

**File**: `src/app/auth/pending/page.tsx`

**Goal**: Mode determined by actual session state, not URL params.

Current structure: a single client component that reads `?verify=1` from the URL.

New structure:
- Keep as a client component (already imports `useSearchParams`, `authModel`)
- Use `useSession()` from `next-auth/react` to read actual `session.user.emailVerified` and `session.user.organizationSlug`
- Determine mode:
  ```
  const { data: session, status } = useSession()
  
  if (status === "loading") → show spinner
  if (session?.user.organizationSlug) → router.replace(`/org/${session.user.organizationSlug}`)
  if (session?.user.emailVerified === true) → show CREATE-ORG mode (step 2)
  else → show INBOX mode (step 1)
  ```
- The `verify=1` param becomes an **initial hint** only (to avoid flicker on first render before session loads). The session is the source of truth once loaded.
- Remove the `isVerifyFlow` branch that only reads from URL — replace with the session-driven state machine above.
- Add `<ActivationStepper currentStep={emailVerified ? 2 : 1} />` at the top of each mode.
- Remove the "Cuenta pendiente de activación" copy — that message was for a different (legacy) state. The two valid states are now "check inbox" and "create org".

---

### Phase 4 — Add `/org/new` guard

**File**: `src/middleware.ts`

**Goal**: Unverified users cannot reach the org-creation page.

In the email verification check block (lines 140-159), add before the org-slug redirect logic:

```typescript
if (pathname.startsWith("/org/new") && session?.user?.emailVerified === false) {
  return NextResponse.redirect(new URL("/auth/pending?verify=1", request.url))
}
```

Note: `/org/new` is already inside the `PROTECTED_ROUTES` list via `/org`, so authentication is already required. This adds the additional email-verification requirement.

---

### Phase 5 — `ActivationStepper` component

**File**: `src/components/activation-stepper.tsx` (new file)

**Goal**: Show the three-step progress indicator on pending page and `/org/new`.

Props: `currentStep: 1 | 2 | 3`

Steps:
1. Verify email
2. Create organization
3. Dashboard

Design: horizontal step row using shadcn/ui primitives or plain Tailwind. Each step has:
- A circle indicator (filled/checkmark for completed, highlighted ring for current, muted for upcoming)
- A label below
- A connector line between steps

Example markup shape (Tailwind):
```tsx
<div className="flex items-center justify-between w-full max-w-sm mx-auto mb-6">
  {steps.map((step, i) => (
    <Fragment key={step.label}>
      <div className="flex flex-col items-center gap-1">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium", 
          i + 1 < currentStep && "bg-blue-600 text-white",       // completed
          i + 1 === currentStep && "border-2 border-blue-600 text-blue-600", // current
          i + 1 > currentStep && "border-2 border-gray-300 text-gray-400",   // upcoming
        )}>
          {i + 1 < currentStep ? <Check className="h-4 w-4" /> : i + 1}
        </div>
        <span className={cn("text-xs", i + 1 === currentStep ? "text-gray-900 font-medium" : "text-gray-400")}>
          {step.label}
        </span>
      </div>
      {i < steps.length - 1 && (
        <div className={cn("flex-1 h-px mx-2", i + 1 < currentStep ? "bg-blue-600" : "bg-gray-200")} />
      )}
    </Fragment>
  ))}
</div>
```

---

### Phase 6 — Add stepper to `/org/new`

**File**: `src/app/org/new/page.tsx`

Import and render `<ActivationStepper currentStep={2} />` above the `<Card>` element. This gives the user context that they are on step 2 of 3.

No other changes to this file.

---

### Phase 7 — Tests

**File**: `src/__tests__/features/auth.test.ts`

Add a new `describe("emailVerification", ...)` block matching the scenarios added in Phase 0.

Key test cases:
- Mock `useSession()` to return `{ emailVerified: false }` → pending page shows inbox mode
- Mock `useSession()` to return `{ emailVerified: true, organizationSlug: undefined }` → pending page shows create-org mode
- Mock `useSession()` to return `{ emailVerified: true, organizationSlug: "gigflow" }` → pending page redirects to `/org/gigflow`
- `emailVerified: true` in session does not trigger middleware redirect to `/auth/pending?verify=1`

---

## Technical Dependencies

| Item | Status |
|---|---|
| `next-auth` `unstable_update()` | Already used in `src/app/org/new/actions.ts` — no new setup |
| `useSession()` from `next-auth/react` | Standard NextAuth hook — check if `SessionProvider` is already in the app layout |
| shadcn/ui `cn` utility | Already in project |
| `lucide-react` `Check` icon | Already used in the project |

**Pre-check**: Confirm `SessionProvider` wraps the app (needed for `useSession()` in the pending page). If not present, it must be added to the root layout or the auth layout segment.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `unstable_update()` does not set cookies correctly in Route Handlers | Test in isolation. If it fails, fall back to clearing cookies + `from=/auth/pending` for both paths — Phase 1's bug fix still makes the post-login experience correct. |
| `useSession()` adds a network round-trip on pending page load | Accept the brief loading spinner. The session is small and cached by NextAuth. |
| `/auth/pending` redirects to `/org/{slug}` but middleware already handles that | Ensure the redirect inside the component fires before user sees a flash. Use `router.replace()` not `router.push()`. |
| `SessionProvider` missing from layout | If not present, `useSession()` throws. Check the root layout before implementing Phase 3. |
| Invite-accepted musicians with no org somehow land on pending page | The pending page now redirects org users to `/org/{slug}`. Musicians without org (`organizationSlug: undefined`) and `emailVerified: true` would see the create-org mode — but they'd never navigate there naturally (they aren't sent to `/auth/pending` by middleware). No action needed. |

---

## Out of Scope

- Changing the invite acceptance flow (`src/app/auth/accept-invite/page.tsx`)
- Password reset flow
- Social / OAuth login
- Admin-side user management
- Email template changes
- Rate limiting on the verify-email route (already handled by Upstash/in-process middleware)
