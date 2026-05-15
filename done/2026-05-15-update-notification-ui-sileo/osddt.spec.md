# Spec: Update Notification UI — Sileo Toast Library

**Feature:** `update-notification-ui-sileo`  
**Date:** 2026-05-14  
**Status:** Draft

---

## Overview

The app currently has no toast feedback layer — notification mutations (mark as read, delete, load failures) happen silently. Users get no confirmation that their actions succeeded or failed.

This feature replaces the existing (unused) Radix-based `Toaster` with Sileo — a physics-based React toast library — and wires it to notification actions so users receive animated, contextual feedback for every notification interaction.

The persistent notification UI (bell dropdown, notifications center page) is **not** changed.

---

## Requirements

### R1 — Toast on notification actions
When a user performs any of the following actions, a Sileo toast must appear confirming the outcome:

| Action | Success toast | Error toast |
|--------|---------------|-------------|
| Mark single notification as read | "Marcado como leído" (success) | "Error al marcar" (error) |
| Mark all notifications as read | "Todas marcadas como leídas" (success) | "Error al marcar todas" (error) |
| Delete a notification | "Notificación eliminada" (success) | "Error al eliminar" (error) |
| Load notifications fails | — | "Error al cargar notificaciones" (error) |

### R2 — Toast type matches notification type
When a new notification arrives (via `addNotification`), the Sileo toast variant must match the notification's `type` field:
- `success` → green/success toast
- `error` → red/error toast  
- `warning` → amber/warning toast
- `info` → blue/info toast

### R3 — Action toasts for actionable notifications
When a new notification has both `actionText` and `actionUrl` populated, the toast must include a clickable button that navigates to `actionUrl`.

### R4 — Single toast system
Only one toast system must be mounted in the app. The existing `Toaster` (Radix-based, from `app/providers.tsx`) must be replaced by Sileo's `<Toaster>`.

### R5 — All toast text in Spanish
All toast titles and descriptions must be in Spanish, consistent with the rest of the UI (es-MX locale).

---

## Scope

### In scope
- Install and mount Sileo `<Toaster>` as the sole toast provider
- Wire Sileo toasts to Effector effects for: mark read, mark all read, delete, load failure, add notification
- Remove the existing Radix `Toaster` from providers
- Remove unused `sonner` package (or `components/ui/sonner.tsx` wrapper) to avoid dead code
- All toast messages in Spanish

### Out of scope
- Notification bell dropdown UI changes
- Notifications center page UI changes  
- Notification schema changes
- Adding new notification types beyond the current 4 (`info|warning|success|error`)
- Undo/optimistic rollback on delete (can be added later via Sileo action button)
- Dark mode styling for Sileo toasts (deferred until dark mode theming is confirmed for the app)

---

## Acceptance Criteria

1. Marking a notification as read shows a green Sileo success toast in Spanish.
2. Marking all notifications as read shows a green Sileo success toast in Spanish.
3. Deleting a notification shows a green Sileo success toast in Spanish.
4. Any of the above failing shows a red Sileo error toast in Spanish.
5. A failed notification load shows a red Sileo error toast in Spanish.
6. A new incoming `addNotification` event shows a toast whose variant matches the notification's `type`.
7. A new notification with `actionText` + `actionUrl` shows a Sileo action toast with a button that navigates to the URL.
8. No two toast systems are mounted simultaneously (no Radix `Toaster` + Sileo `Toaster` coexisting).
9. The app builds and runs without errors after `sonner` / Radix toast removal.
10. Existing notification bell dropdown and notifications center page are visually and functionally unchanged.

---

## Research Summary

From `osddt.research.md`:

- **Sileo is toast-only.** No bell, no feed, no persistent state — it covers transient feedback only.
- **Current toast is broken/incomplete.** The Radix `Toaster` is mounted but no `toast()` calls exist anywhere in the codebase — silence on all notification mutations.
- **Sonner is installed but unused.** `sonner@^2.0.7` lives in `package.json` and `components/ui/sonner.tsx` exists but is never mounted. Removing it simplifies the dep tree.
- **Type mapping is perfect.** `NotificationSchema.type` (`info|warning|success|error`) maps 1:1 to Sileo's four toast methods.
- **Integration point is `features/notifications/model.ts`.** Wiring via Effector `sample()` or `watch()` on effect `.done`/`.fail` units — no UI component changes needed.
- **All UI text is in Spanish (es-MX).** Toast copy must match.

---

## Decisions

1. **Old toast cleanup**: Remove `sonner` completely from `package.json`, remove `components/ui/sonner.tsx`, remove Radix `@radix-ui/react-toast` and all related shadcn toast components (`components/ui/toaster.tsx`, `components/ui/toast.tsx`, `hooks/use-toast.ts`).
2. **Feedback triggers**: `addNotification` fires a Sileo toast for both programmatic additions (e.g., server push) and user-initiated mutations.
3. **Action button URL**: Support both — action button navigates in the same tab; users can open in a new tab via browser context menu.
