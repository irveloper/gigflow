# Research: Error/Bundler Styles Not Rendering on Auth Pages

**Date**: 2026-05-18  
**Branch**: main

---

## Topic

Auth page `/auth/pending?verify=1` renders `<Navigation />` on top, breaking the intended full-screen gradient layout. User reports "error styles not rendering beautifully" — the pending/verify page should be a clean, centered, full-screen card without any app navigation.

---

## Codebase Findings

### Root Cause

`app/layout.tsx` (root layout, applies to ALL routes) unconditionally renders `<Navigation />`:

```tsx
// app/layout.tsx line 33–35
<Providers>
  <Navigation />
  {children}
</Providers>
```

The `Navigation` component (`widgets/navigation/ui.tsx`) only guards on:
```tsx
if (!user || !userRole) return null  // line 57
```

On `/auth/pending?verify=1`, the user IS authenticated with a role (e.g. "manager"), so Navigation renders. This causes:
1. Navigation bar shows on auth pages (Dashboard, Calendario, Reportes, Notificaciones visible in screenshot)
2. The page's `min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100` only fills viewport *below* the nav bar, not the full screen
3. Background bleed visible on sides (content from other DOM layers)

### Auth Page Layout

`app/auth/pending/page.tsx` — full-screen wrapper:
```tsx
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
```

This is correct but broken by the nav above it.

### Error State Rendering

The pending page handles `?error=expired` (line 16) and inline `resendError` (line 34):
```tsx
{resendError && (
  <p className="text-sm text-destructive text-center">{resendError}</p>
)}
```
`text-destructive` uses CSS custom property `--destructive` from shadcn — works when globals.css loads. No issue found there.

### Route Structure

```
app/
  layout.tsx          ← Navigation rendered here (ALL routes — BUG)
  (authenticated)/
    layout.tsx        ← "use client" auth guard, no Navigation
  auth/               ← No layout.tsx — inherits root layout
    pending/page.tsx
    login/page.tsx
    ...
  org/[slug]/layout.tsx  ← auth guard only, no Navigation
  superadmin/layout.tsx  ← auth guard only, no Navigation
```

Auth pages have NO dedicated layout to block Navigation. They fall through to root layout.

### Navigation Component

`widgets/navigation/ui.tsx` — only guard is user/role presence:
```tsx
const [user, userRole, unreadCount, organization] = useUnit([$user, $userRole, $unreadCount, $organization])
if (!user || !userRole) return null
```

No pathname-based hiding, no `isPending` check.

---

## External References

- Next.js route groups `(authenticated)` — pages inside are protected but Navigation is still root-level
- shadcn `text-destructive` — works via CSS vars, not a Tailwind purge issue

---

## Key Insights

1. **Nav should never show on `/auth/*` paths** — these are standalone full-screen pages
2. The gradient DOES render (from-blue-50 to-indigo-100 is very light, almost white — correct behavior) but is pushed below nav
3. Error messages on the pending page use `text-destructive` which is fine
4. The "beautiful error rendering" likely refers to the broken full-screen layout — nav eating into the viewport

---

## Constraints & Risks

- `app/layout.tsx` is a Server Component — can't add `usePathname()` there directly
- `Navigation` is a Client Component — can safely add `usePathname()` check
- Moving Navigation to per-layout files requires touching `(authenticated)/layout.tsx`, `org/[slug]/layout.tsx`, `superadmin/layout.tsx`

---

## Proposed Fix

**Minimal surgical fix**: Add `pathname.startsWith("/auth")` check in `Navigation` component to return `null` on auth routes.

```tsx
// widgets/navigation/ui.tsx — add before user/role check
const pathname = usePathname()
if (pathname.startsWith("/auth") || 
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/billing-suspended")) return null
```

This is minimal, safe, and doesn't require restructuring layouts.

**Alternatively (architecturally cleaner)**: Move `<Navigation />` from `app/layout.tsx` to each authenticated layout (`(authenticated)/layout.tsx`, `app/org/[slug]/layout.tsx`, `app/superadmin/layout.tsx`). But `(authenticated)/layout.tsx` is a client component — adding Navigation there is fine.

---

## Open Questions

- Should `Navigation` also be hidden on `/onboarding` and `/billing-suspended` pages? (Likely yes — same pattern)
- Should the superadmin layout have a different nav style or the same?
