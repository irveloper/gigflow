# Research: Is the "better-roles" feature ready?

**Branch:** `icaamal/feat-better-roles`  
**Date:** 2026-05-22  
**Researched by:** Claude (claude-sonnet-4-6)

---

## Topic

Assess whether the "better-roles" feature — allowing org owners to self-register and role-aware onboarding — is production-ready. The feature was implemented in this branch and involves the following changes:

1. `src/server/routers/auth.ts` — removed FORBIDDEN block for `manager` role (self-registration allowed)
2. `src/app/auth/register/page.tsx` — added "Org Owner" option to signup form (value = `manager`)
3. `src/app/auth/pending/page.tsx` — role-aware: manager → "Choose a plan" → `/onboarding/plan`; musician/hotel → "Account active, wait for invite"
4. `src/components/activation-stepper.tsx` — added `variant` prop: `"manager"` (3 steps) vs `"member"` (2 steps)

---

## Codebase Findings

### A. Middleware — musician/hotel with no org
- **File:** `src/middleware.ts:140–163`
- After email verification, a musician/hotel with `organizationSlug = null` who accesses `/org/...` is redirected to `/auth/pending`.
- `/auth/pending` shows the correct "Account active, wait for invite" UI.
- **No infinite redirect loop.** Flow is: `/org/[slug]` → `/auth/pending` → member message.
- However, if a musician directly navigates to `/` or `/calendar`, the middleware does NOT redirect them to pending. They see the protected route without an org context, which may break features silently.

### B. Org layout guard
- **File:** `src/app/org/[slug]/layout.tsx:22–29`
- Non-superadmin without `organizationSlug` → `redirect("/auth/pending")`. Clean, no loop.

### C. Manager re-login gap (BLOCKING)
- **File:** `src/middleware.ts:160–163`
- After a manager registers, verifies email, then logs out and back in:
  - `organizationSlug` is `undefined` in JWT
  - Middleware only redirects to `/org/{slug}` **if** `orgSlug` truthy — skipped
  - Manager lands on `/` with no org, no prompt to complete setup
- **Gap:** There is no guard that redirects a manager with `emailVerified = true` + `organizationId = null` back to `/auth/pending` to complete onboarding after a session re-entry.

### D. `/onboarding/plan` — tRPC procedure
- **File:** `src/server/routers/organizations.ts:46`
- `initiateCheckout` uses `protectedProcedure` (requires any authenticated user, NOT `managerProcedure`)
- A newly self-registered manager (no org yet) **can** call this — works correctly.
- ✅ No issue.

### E. JWT stale after Stripe webhook (BLOCKING)
- **Files:** `src/app/api/webhooks/stripe/route.ts`, `src/app/onboarding/success/page.tsx`
- After Stripe checkout completes:
  - Webhook creates org and updates `User.organizationId` in DB
  - Webhook does NOT call `unstable_update` (can't — server-side, no session context)
  - `/onboarding/success` polls `billing.getSubscription` via `orgProcedure`
  - `orgProcedure` reads `ctx.organizationId` from the **JWT** (stale — still null)
  - Result: polling throws "No organization context" until user manually refreshes session
- **Current mitigation:** 2s poll × 15 attempts = 30s window; webhook usually runs in <1s, and on next poll the user may have refreshed. Usually works but not guaranteed.
- Compare: `src/app/org/new/actions.ts:27–33` uses `unstable_update` to flush JWT after `createOrgAction` — the proper pattern.

### F. Missing role guard in `/org/new` (SECURITY)
- **File:** `src/app/org/new/actions.ts:6–35`
- `createOrgAction` checks `session?.user?.id` but NOT the user's role
- Hardcodes `role: "manager"` on update (line 23)
- **Risk:** A musician who manually navigates to `/org/new` (protected, but reachable) gets org created and is upgraded to `manager`, bypassing the role model
- **Mitigation:** Pending page now sends managers to `/onboarding/plan` (not `/org/new`), reducing exposure, but a manual URL visit still works.

### G. Tests — manager registration not covered
- **File:** `src/__tests__/features/auth.test.ts`
- No test for manager self-registration
- No test for manager re-login flow with no org
- Removing the FORBIDDEN block is not tested
- The scenarios in `src/specs/features/auth.scenarios.ts` don't include org-owner onboarding path

### H. Type correctness
- **File:** `src/entities/user/schema.ts:3`
- `UserRoleSchema = z.enum(["musician", "manager", "hotel"])` — already included `manager`
- `RegisterInputSchema.role: UserRoleSchema` — accepts `manager`
- Frontend now sends `manager` in the select — matches schema
- ✅ No type drift.

---

## External References

- NextAuth `unstable_update` pattern for JWT flush: used in `src/app/org/new/actions.ts:27–33` and `src/app/api/auth/verify-email/route.ts`
- Stripe Checkout `subscription_data.metadata` is the carrier for org context across the async webhook boundary

---

## Key Insights

1. The core feature works for the **happy path**: register as Org Owner → verify email → choose plan → Stripe checkout → success. The pieces are all present.
2. The **re-login gap** means an org owner who bounces mid-onboarding (verifies email, logs out, comes back) will land on `/` with no prompt to complete setup. This is a broken user journey.
3. The **JWT staleness after Stripe webhook** is a known race condition that usually resolves itself within 2s, but is not guaranteed and has no retry logic.
4. The `/org/new` free-tier bypass is a minor security concern that allows plan evasion.

---

## Constraints & Risks

| # | Severity | Description |
|---|----------|-------------|
| 1 | **MEDIUM** | Re-login gap: manager with no org who logs back in lands on `/` with no path to `/auth/pending` |
| 2 | **MEDIUM** | JWT stale after Stripe webhook: polling may fail if session doesn't refresh before first poll |
| 3 | **LOW** | `/org/new` lacks role guard — musician can manually create an org and get manager role |
| 4 | **LOW** | musician/hotel accessing `/`, `/calendar` directly after email verify sees broken UI (no org context) |
| 5 | **INFO** | No tests for manager self-registration and re-login flow |

---

## Open Questions

1. **Re-login guard**: Should the middleware redirect managers with `emailVerified = true` + `organizationId = null` to `/auth/pending`? Or should the `/` page handle this gracefully client-side?

2. **JWT refresh in success page**: Should `/onboarding/success` call `signIn` (soft reauth) or `update()` before polling `getSubscription`, to force a JWT refresh?

3. **`/org/new` access**: Should `createOrgAction` add `if (session.user.role !== "manager") throw new Error("Unauthorized")`? Or should the route be protected at middleware level (only accessible by managers)?

4. **Musician/hotel with no org accessing protected routes**: Should middleware block them from `/calendar`, `/profile` etc., or is "show partial UI without org" acceptable for MVP?

5. **Test coverage**: Should manager registration scenarios be added to `src/specs/features/auth.scenarios.ts` before merging?
