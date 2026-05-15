# Tasks: Update Notification UI — Sileo Toast Library

**Feature:** `update-notification-ui-sileo`  
**Date:** 2026-05-14

---

## Phase 1 — Install Sileo & Swap Provider

> **Goal:** Sileo mounted as sole toast provider, old Radix Toaster removed from providers.  
> **Definition of Done:** App runs, `<Toaster>` in DOM is from Sileo, no import errors.

- [x] [S] Install `sileo` package via `pnpm add sileo`
- [x] [S] Update `app/providers.tsx` — replace `import { Toaster } from "@/components/ui/toaster"` with `import { Toaster } from "sileo"` and set `<Toaster position="bottom-right" />`

---

## Phase 2 — Delete Old Toast Infrastructure

> **Goal:** Zero dead toast code. No Radix toast, no sonner.  
> **Definition of Done:** All 6 files deleted, both packages removed, `pnpm install` succeeds.  
> **Dependency:** Phase 3 must complete first (deleting shared/lib/use-toast.ts will break Phase 3 call sites if done before migration).

- [x] [S] Run `pnpm why @radix-ui/react-toast` to confirm it is safe to remove as a direct dep
- [x] [S] Run `pnpm remove sonner` to remove sonner from package.json and lockfile
- [x] [S] Remove `@radix-ui/react-toast` from `package.json` direct dependencies
- [x] [S] Delete `components/ui/toast.tsx`
- [x] [S] Delete `components/ui/toaster.tsx`
- [x] [S] Delete `components/ui/sonner.tsx`
- [x] [S] Delete `components/ui/use-toast.ts`
- [x] [S] Delete `hooks/use-toast.ts`
- [x] [S] Delete `shared/lib/use-toast.ts`

---

## Phase 3 — Migrate All `useToast` Call Sites

> **Goal:** All 9 files using `useToast` / `toast()` migrated to `sileo.*()`.  
> **Definition of Done:** No file imports `useToast` or `@/shared/lib/use-toast` or `@/components/ui/toast`. TypeScript compiles cleanly.  
> **Dependency:** Phase 1 must complete first (sileo must be installed).

- [x] [M] Migrate `app/auth/login/page.tsx` — read file, replace `useToast` hook with `sileo.error()` / `sileo.success()` per variant
- [x] [M] Migrate `app/auth/register/page.tsx` — read file, replace `useToast` hook with `sileo.error()` / `sileo.success()` per variant
- [x] [M] Migrate `app/(authenticated)/admin/users/page.tsx` — read file, map CRUD feedback to correct Sileo variant
- [x] [M] Migrate `app/(authenticated)/profile/page.tsx` — read file, map save/error feedback
- [x] [M] Migrate `widgets/calendar/ui.tsx` — read file, map calendar action feedback
- [x] [M] Migrate `widgets/admin-events/ui.tsx` — read file, map event CRUD feedback
- [x] [M] Migrate `widgets/admin-musicians/ui.tsx` — read file, map musician CRUD feedback
- [x] [M] Migrate `widgets/admin-hotels/ui.tsx` — read file, map hotel CRUD feedback
- [x] [M] Migrate `widgets/check-in-form/ui.tsx` — read file, map check-in success/error feedback
- [x] [S] Check `__tests__/` for any imports from deleted toast files and remove them

---

## Phase 4 — Wire Notification Effects to Sileo

> **Goal:** Effector notification effects fire Sileo toasts on success and failure.  
> **Definition of Done:** `markAsReadFx`, `markAllAsReadFx`, `deleteNotificationFx`, `loadNotificationsFx`, and `addNotification` all have Sileo `watch()` wiring. All toast text is in Spanish.  
> **Dependency:** Phase 1 must complete first.

- [x] [S] Add `import { sileo } from "sileo"` to `features/notifications/model.ts`
- [x] [S] Wire `markAsReadFx.done` → `sileo.success({ title: "Marcado como leído" })`
- [x] [S] Wire `markAsReadFx.fail` → `sileo.error({ title: "Error al marcar" })`
- [x] [S] Wire `markAllAsReadFx.done` → `sileo.success({ title: "Todas marcadas como leídas" })`
- [x] [S] Wire `markAllAsReadFx.fail` → `sileo.error({ title: "Error al marcar todas" })`
- [x] [S] Wire `deleteNotificationFx.done` → `sileo.success({ title: "Notificación eliminada" })`
- [x] [S] Wire `deleteNotificationFx.fail` → `sileo.error({ title: "Error al eliminar" })`
- [x] [S] Wire `loadNotificationsFx.fail` → `sileo.error({ title: "Error al cargar notificaciones" })`
- [x] [M] Wire `addNotification.watch()` — dispatch typed toast (success/error/warning/info) matching `notification.type`; if `actionUrl` + `actionText` present, use `sileo.action()` with button navigating via `window.location.href`

---

## Phase 5 — Verify & Clean Up

> **Goal:** App builds, tests pass, no stale imports.  
> **Definition of Done:** `pnpm build` exits 0, `pnpm test:run` exits 0, grep finds no remaining `useToast`/`sonner`/`react-toast` imports.

- [x] [S] Grep for remaining `useToast` imports — fix any found
- [x] [S] Grep for remaining imports from `@/components/ui/toast`, `@/components/ui/toaster`, `@/shared/lib/use-toast`, `sonner` — fix any found
- [x] [M] Run `pnpm build` — resolve any TypeScript or import errors (pre-existing `auth.ts` error unrelated to this feature)
- [x] [S] Run `pnpm test:run` — confirm notification tests pass (53/53 ✓)
- [ ] [S] Smoke-test in browser — trigger one toast action and confirm Sileo animation renders

---

## Dependency Order

```
Phase 1 (install)
  ↓
Phase 3 (migrate call sites) ← must happen before Phase 2 deletes shared files
  ↓
Phase 2 (delete old files)
  ↓  ↓
Phase 4 (wire effects)   [can run in parallel with Phase 2]
  ↓
Phase 5 (verify)
```
