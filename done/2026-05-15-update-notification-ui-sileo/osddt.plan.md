# Plan: Update Notification UI — Sileo Toast Library

**Feature:** `update-notification-ui-sileo`  
**Date:** 2026-05-14  
**Stack:** Next.js 16, React 19, Effector, tRPC, Tailwind v4, shadcn/ui, pnpm

---

## Architecture Overview

Replace the Radix-based `useToast` / `Toaster` infrastructure with Sileo across the entire app, then wire Sileo to Effector notification effects.

**Before:**
```
useToast() hook (Radix) → components/ui/toaster.tsx → app/providers.tsx <Toaster>
```

**After:**
```
sileo.success/error/warning/info() → providers.tsx <Toaster from "sileo">
```

**Key decisions:**
- `sileo` is the **only** toast system — `@radix-ui/react-toast`, `sonner`, all related files removed
- Sileo calls in `features/notifications/model.ts` via Effector `watch()` on effect done/fail
- All other call sites (`auth`, `admin widgets`, `profile`, `calendar`, `check-in`) migrated from `useToast` → `sileo.*()` directly (no hook needed)
- Notification bell dropdown + notifications center page: **unchanged**

---

## Implementation Phases

### Phase 1 — Install Sileo & Swap Provider

**Goal:** Sileo mounted, old Radix Toaster removed.

1. `pnpm add sileo`
2. In `app/providers.tsx`:
   - Remove `import { Toaster } from "@/components/ui/toaster"`
   - Add `import { Toaster } from "sileo"`
   - Replace `<Toaster />` → `<Toaster position="bottom-right" />`

**Files changed:** `app/providers.tsx`, `package.json`, `pnpm-lock.yaml`

---

### Phase 2 — Delete Old Toast Infrastructure

**Goal:** Zero dead code. Remove all Radix toast and sonner files.

Files to delete:
- `components/ui/toast.tsx`
- `components/ui/toaster.tsx`
- `components/ui/sonner.tsx`
- `components/ui/use-toast.ts`
- `hooks/use-toast.ts`
- `shared/lib/use-toast.ts`

Packages to remove from `package.json`:
- `@radix-ui/react-toast`
- `sonner`

Run: `pnpm remove sonner` (note: `@radix-ui/react-toast` may be a transitive dep — check before removing from package.json directly; if it's only in devDeps/direct deps, remove it; if transitive via shadcn, just remove from direct deps).

**Files changed:** deletions above + `package.json` + `pnpm-lock.yaml`

---

### Phase 3 — Migrate All `useToast` Call Sites

**Goal:** All 9 files that called `toast()` via `useToast` now call `sileo.*()` directly.

**Migration pattern:**
```tsx
// Before
import { useToast } from "@/shared/lib/use-toast"
const { toast } = useToast()
toast({ title: "Success message" })
toast({ title: "Error message", variant: "destructive" })

// After
import { sileo } from "sileo"
sileo.success({ title: "Success message" })
sileo.error({ title: "Error message" })
```

**Files to migrate (9 total):**

| File | Notes |
|------|-------|
| `app/auth/login/page.tsx` | Auth errors → `sileo.error`, success → `sileo.success` |
| `app/auth/register/page.tsx` | Auth errors → `sileo.error`, success → `sileo.success` |
| `app/(authenticated)/admin/users/page.tsx` | Admin CRUD feedback |
| `app/(authenticated)/profile/page.tsx` | Profile save feedback |
| `widgets/calendar/ui.tsx` | Calendar action feedback |
| `widgets/admin-events/ui.tsx` | Event CRUD feedback |
| `widgets/admin-musicians/ui.tsx` | Musician CRUD feedback |
| `widgets/admin-hotels/ui.tsx` | Hotel CRUD feedback |
| `widgets/check-in-form/ui.tsx` | Check-in success/error |

**Variant mapping rule:**
- `variant: "destructive"` → `sileo.error()`
- Default / no variant → `sileo.success()`
- Explicit warning context → `sileo.warning()`
- Neutral info context → `sileo.info()`

Remove `useToast` import and hook instantiation from each file after migration.

---

### Phase 4 — Wire Notification Effects to Sileo

**Goal:** Effector notification effects fire Sileo toasts on done/fail.

**File:** `features/notifications/model.ts`

Add `watch()` calls after effect declarations (outside components, at module level):

```typescript
import { sileo } from "sileo"

// Mark single as read
markAsReadFx.done.watch(() => sileo.success({ title: "Marcado como leído" }))
markAsReadFx.fail.watch(() => sileo.error({ title: "Error al marcar" }))

// Mark all as read
markAllAsReadFx.done.watch(() => sileo.success({ title: "Todas marcadas como leídas" }))
markAllAsReadFx.fail.watch(() => sileo.error({ title: "Error al marcar todas" }))

// Delete
deleteNotificationFx.done.watch(() => sileo.success({ title: "Notificación eliminada" }))
deleteNotificationFx.fail.watch(() => sileo.error({ title: "Error al eliminar" }))

// Load failure
loadNotificationsFx.fail.watch(() => sileo.error({ title: "Error al cargar notificaciones" }))

// Add notification (new incoming — both programmatic and user-triggered)
addNotification.watch((notification) => {
  const typeMap = {
    success: () => sileo.success({ title: notification.title, description: notification.message }),
    error:   () => sileo.error({   title: notification.title, description: notification.message }),
    warning: () => sileo.warning({ title: notification.title, description: notification.message }),
    info:    () => sileo.info({    title: notification.title, description: notification.message }),
  }
  
  if (notification.actionUrl && notification.actionText) {
    // Action toast — navigate same tab
    sileo.action({
      title: notification.title,
      description: notification.message,
      button: {
        title: notification.actionText,
        onClick: () => { window.location.href = notification.actionUrl! },
      },
    })
    return
  }

  typeMap[notification.type]?.()
})
```

**Files changed:** `features/notifications/model.ts`

---

### Phase 5 — Verify & Clean Up

**Goal:** App builds, tests pass, no broken imports.

1. Run `pnpm build` — check for remaining imports from deleted files
2. Run `pnpm test:run` — ensure notification tests still pass (they test Effector stores, not toast side effects, so should be unaffected)
3. Grep for any remaining `useToast` / `from.*components/ui/toast` / `from.*sonner` imports
4. Verify Sileo `<Toaster>` renders in browser — test one action manually

---

## Technical Dependencies

| Dependency | Action |
|------------|--------|
| `sileo` | Add — `pnpm add sileo` |
| `@radix-ui/react-toast` | Remove from direct deps |
| `sonner` | Remove — `pnpm remove sonner` |
| `components/ui/toast.tsx` | Delete |
| `components/ui/toaster.tsx` | Delete |
| `components/ui/sonner.tsx` | Delete |
| `components/ui/use-toast.ts` | Delete |
| `hooks/use-toast.ts` | Delete |
| `shared/lib/use-toast.ts` | Delete |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `@radix-ui/react-toast` used as transitive dep by another shadcn component | Check with `pnpm why @radix-ui/react-toast` before removing from package.json; if transitive, only remove from direct deps in package.json |
| `window.location.href` in action button breaks SSR | Wrap in `typeof window !== 'undefined'` or use Next.js `router.push` via a client-side wrapper; `sileo.action()` is always called client-side so this is safe |
| Dark mode — Sileo has no documented dark mode API | Sileo's `styles` prop accepts class overrides per-toast; defer dark mode Sileo styling until the app's dark mode implementation is confirmed |
| Test files import from deleted files | Check `__tests__/` for any direct imports of `use-toast`; if found, remove those imports (tests shouldn't test toast display) |
| Phase 3 scope creep — 9 files with varied `toast()` call patterns | Read each file before migrating; don't assume all toasts are `success` — inspect `variant` field |

---

## Out of Scope

- Notification bell dropdown UI changes
- Notifications center page UI changes
- Dark mode styling for Sileo toasts
- Undo/optimistic rollback on delete
- Toast deduplication logic
- Custom Sileo icon overrides
- Adding new notification types
