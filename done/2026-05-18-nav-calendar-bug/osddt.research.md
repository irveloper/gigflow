# Research: Nav Calendar Link Intermittent Bug

## Topic
Why clicking "Calendar" in the nav/header sometimes navigates to the wrong route after login — specifically the legacy `/calendar` route instead of the correct `/org/<slug>/calendar` route.

## Codebase Findings

### Navigation link construction (`widgets/navigation/ui.tsx:59`)
```ts
const prefix = organization?.slug ? `/org/${organization.slug}` : ""
const navigationItems = buildNavItems(prefix)
```
The nav prefix is derived entirely from `$organization` (Effector store). When `$organization = null`, all links drop the org prefix: calendar becomes `/calendar`, not `/org/<slug>/calendar`.

### `$organization` load chain
1. `providers.tsx:useEffect` → calls `authModel.checkAuth()` (on every app mount)
2. `checkAuthFx` runs → reads NextAuth session via `next-auth/react` `getSession()` (async)
3. On `checkAuthFx.doneData` → `features/org/model.ts` fires `loadMyOrgFx` (another async API call: `trpc.organizations.getMyOrg.query()`)
4. On `loadMyOrgFx.doneData` → `organizationSet` fires → `$organization` populated

**Two async hops** before `$organization` is available.

### The race window
Between app mount and `loadMyOrgFx` resolving, `$organization = null`. During this window the nav shows incorrect links. Window length = `checkAuthFx` duration + `loadMyOrgFx` duration (two sequential network round-trips). This is why the bug is intermittent: fast network shortens the window, slow network extends it.

### `organizationSlug` is available in the JWT session — but dropped
`types/next-auth.d.ts` declares `organizationSlug: string | undefined` in the session/JWT.  
`auth.ts:89` populates it: `organizationSlug: dbUser.organization?.slug ?? undefined`.  
BUT `shared/lib/session.ts:sessionToUser()` **does not include `organizationSlug`** in the returned `User` object.  
AND `entities/user/schema.ts:UserSchema` **does not have an `organizationSlug` field**.  
So the slug is thrown away when converting the session to the Effector user store.

### Dual calendar routes
- `app/(authenticated)/calendar/page.tsx` — legacy route group (client-side auth guard)
- `app/org/[slug]/calendar/page.tsx` — org route (server-side auth guard)
- Both render identical `<CalendarExperience />` — same component, different layout wrappers

### `app/(authenticated)/layout.tsx` — client auth guard behavior
```tsx
if (!isAuthResolved || user === null) return <Loading />
```
`$isAuthResolved` is `false` until `checkAuthFx.finally` fires. If user navigates to `/calendar` WHILE `checkAuthFx` is still pending, they see a loading spinner — perceived as "broken". Eventually resolves and shows the calendar correctly, but URL is wrong.

### `app/org/[slug]/layout.tsx` — server auth guard
Checks `session.user.organizationSlug === slug`. No client-side delay. Renders `<Navigation />` directly.

### Post-login redirect flow
Login page → `router.replace("/")` → `app/page.tsx` (RSC) reads session → redirects to `/org/<slug>`. By the time user is at `/org/<slug>`, client hydration begins and the race window opens.

### Check-in link bug (secondary)
Inside `CalendarExperience`, check-in links use hardcoded `/check-in/${event.id}` — missing the org prefix. Affected code: `widgets/calendar/ui.tsx:309` and `widgets/calendar/ui.tsx:449`. Under org routing these should be `/org/<slug>/check-in/${event.id}`.

## External References
- Next.js App Router route groups: `(authenticated)` group vs `org/[slug]` route
- NextAuth.js JWT session — `organizationSlug` is already in the JWT, no extra DB call needed
- Effector async model — `createEffect` + `sample` chains for reactive state

## Key Insights

1. **Root cause**: `$organization` requires two sequential async calls after mount. The `organizationSlug` is already embedded in the JWT (fast, cookie-read) but gets discarded at `sessionToUser`.

2. **Fix opportunity**: If `UserSchema` includes `organizationSlug` and `sessionToUser` maps it, then after `checkAuthFx` resolves (one async hop, fast), the Navigation can compute the org prefix from `$user.organizationSlug` — eliminating the second API call dependency for link construction.

3. **`$organization` still needed** for full org data (name, id, status, subscription) used elsewhere, but the nav only needs the `slug`.

4. **The `(authenticated)` layout Loading state** contributes to "doesn't work" perception when user lands on `/calendar` while `checkAuthFx` is still pending — blank screen with spinner.

## Constraints & Risks

- `UserSchema` change (adding `organizationSlug`) must follow SDD: update `specs/entities/` first, then propagate.
- `sessionToUser` change is safe — it only adds a field, no breakage.
- Navigation change: derive prefix from `user?.organizationSlug ?? organization?.slug` — fallback order matters. User store resolves first, org store resolves later (but same or more accurate slug).
- Superadmin has no org — `organizationSlug` will be `undefined`, prefix stays `""`. Existing behavior preserved.
- Pending users have no org — same as above.

## Open Questions

1. Should the Navigation completely drop the `$organization` store dependency and use `$user.organizationSlug` exclusively, or keep `$organization` as primary with user as fallback?
2. Should `loadMyOrgFx` still run (for full org data needed elsewhere) but Navigation stops waiting for it?
3. Are there other places in the UI that derive routes from `$organization?.slug` that have the same race condition?
4. Should `/calendar` (legacy non-org route) be kept, redirected to `/org/<slug>/calendar`, or removed?
5. The check-in link bug in `CalendarExperience` — should it be fixed in the same ticket?
