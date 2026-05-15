# Research: Update Notification UI — Sileo Toast Library

**Branch:** main  
**Date:** 2026-05-14  
**Feature:** `update-notification-ui-sileo`

---

## Topic

Replace or augment the current toast/feedback layer with the Sileo toast library (`sileo` npm package). Sileo is a physics-based, SVG-morphing toast library for React. This does NOT cover the notification bell dropdown or the notifications center page — those are persistent notification UI components that Sileo does not provide.

---

## Codebase Findings

### Current Toast Stack

| Layer | Package | Status |
|-------|---------|--------|
| Primary toaster | `@radix-ui/react-toast` via shadcn `Toaster` | Active — mounted in `app/providers.tsx` |
| `sonner` | `sonner@^2.0.7` | Installed, `components/ui/sonner.tsx` exists, **not mounted** in providers |
| `sileo` | — | Not installed |

`app/providers.tsx` imports `Toaster` from `@/components/ui/toaster` (Radix-based shadcn component). Sonner exists as a component file but is unused.

### Notification UI Components

#### 1. Notification Bell Dropdown
**File:** `widgets/notification-bell/ui.tsx`  
- Radix `DropdownMenu` with bell icon + unread badge
- Shows first 10 notifications; links to full page if more
- Click-to-mark-as-read, "Mark All As Read" action
- Type icons via emoji (✅ ⚠️ ❌ ℹ️)
- Unread items highlighted `bg-blue-50`
- **Not a toast — this is persistent notification history**

#### 2. Notifications Center Page
**File:** `widgets/notifications-center/ui.tsx`  
- Full-page dashboard: stats cards, search, type/status filters
- Per-item read/delete actions
- Timestamps in Spanish (es-MX)
- **Not a toast — this is persistent notification history**

### Notification State (Effector)

**Entity stores** (`entities/notification/model.ts`):
- `$notifications`, `$unreadCount`, `$unreadNotifications`, `$readNotifications`
- Events: `markNotificationRead`, `markAllNotificationsRead`, `removeNotification`

**Feature effects** (`features/notifications/model.ts`):
- `loadNotificationsFx`, `markAsReadFx`, `markAllAsReadFx`, `deleteNotificationFx`
- All wired via `sample()` — effects trigger on events, stores update on effect results

**tRPC API** (`shared/api/notifications.ts`):  
All CRUD ops: `fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`, `createNotification`

### Notification Schema (Zod — source of truth)

```typescript
// entities/notification/schema.ts
export const NotificationTypeSchema = z.enum(["info", "warning", "success", "error"])

export const NotificationSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: NotificationTypeSchema,           // maps directly to sileo methods
  timestamp: z.string().datetime({ offset: true }),
  read: z.boolean().default(false),
  actionUrl: z.string().optional(),
  actionText: z.string().optional(),
  userId: z.string().optional(),
  eventId: z.string().optional(),
})
```

`type` values (`info | warning | success | error`) map 1:1 to Sileo's toast methods.

### Where Toast Feedback Is Triggered

Currently no explicit `toast()` calls found in feature effects. The effects mutate Effector stores silently. Toast feedback would be wired via Effector's `sample()` or `watch()` — e.g., on `markAsReadFx.done`, `deleteNotificationFx.done`, `loadNotificationsFx.fail`.

---

## External References

### Sileo (`sileo` npm package)
**Site:** https://sileo.aaryan.design/

**What it is:** Narrow, high-quality React toast library with SVG-morphing badge icons and spring physics animation.

**Install:**
```bash
pnpm add sileo
```

**Setup (app/layout.tsx or providers.tsx):**
```tsx
import { Toaster } from "sileo";
<Toaster position="top-right" />
```

**Usage:**
```tsx
import { sileo } from "sileo";

sileo.success({ title: "Marked as read" });
sileo.error({ title: "Something went wrong", description: "Try again." });
sileo.warning({ title: "Storage almost full" });
sileo.info({ title: "New update available" });

// Action toast
sileo.action({
  title: "Notification deleted",
  button: { title: "Undo", onClick: handleUndo },
});

// Promise toast (tracks async)
sileo.promise(someEffect(), {
  loading: { title: "Loading..." },
  success: { title: "Done!" },
  error: { title: "Failed" },
});
```

**Key props:**
- `title` (string), `description` (ReactNode)
- `duration` (ms, default 6000; `null` = sticky)
- `position` (per-toast override)
- `icon` (custom ReactNode)
- `styles` (class overrides: `title`, `description`, `badge`, `button`)
- `roundness` (px, default 16)
- `button` (`{ title, onClick }`)

**What Sileo does NOT have:**
- No notification bell / inbox / feed component
- No persistent notification state
- No badge counters
- No CSS variable theming system
- No dark mode API (not documented)

---

## Key Insights

1. **Sileo replaces the toast feedback layer only.** The notification bell dropdown and notifications center page stay as-is — they are persistent notification history UI, not toast UI.

2. **`sonner` is already installed but unused.** Before adding Sileo, evaluate whether to replace sonner or replace the Radix toast. Either way, only one toast system should be mounted.

3. **Type mapping is perfect.** `NotificationSchema.type` enum values (`info|warning|success|error`) map directly to `sileo.info()`, `sileo.warning()`, `sileo.success()`, `sileo.error()`. A single dispatch function can be written.

4. **Effector integration point.** Wire Sileo calls in `features/notifications/model.ts` via `sample({ clock: someFx.done, fn: ... })` or `someFx.watch(...)`. No UI component changes needed.

5. **`actionUrl` + `actionText` fields exist on Notification.** These can be surfaced as Sileo action button (`button: { title: actionText, onClick: () => router.push(actionUrl) }`).

6. **Current `Toaster` is from shadcn (Radix).** Sileo's `<Toaster>` is a different export. Both can coexist temporarily but should be consolidated.

---

## Constraints & Risks

| Risk | Detail |
|------|--------|
| Two toast systems | `@radix-ui/react-toast` (Toaster in providers) + potentially Sileo both mounted = conflicting toasts. Must remove or disable the old Toaster. |
| Sonner already installed | `sonner@^2.0.7` is installed; adding Sileo means 2 unused toast libs. Clean up one. |
| No dark mode docs for Sileo | Theming depth is unknown; `/docs/theming` returns 404. May need custom `styles` prop workarounds. |
| Spanish localization | Current UI is in Spanish (es-MX). Sileo toast `title`/`description` text must be in Spanish to match. |
| No SSR-specific docs | Sileo `sileo.*()` are client-side imperative calls — ensure no server component calls them. |
| Effector effect boundaries | Toast calls must happen after effects resolve, not during store updates, to avoid double-firing. |

---

## Open Questions

1. **Scope:** Replace only the toast feedback layer with Sileo, or also restyle the notification bell dropdown and notifications center to visually match Sileo's aesthetic?
2. **Old toast cleanup:** Remove `sonner` and the Radix `Toaster` from providers, or just disable the Radix `Toaster`?
3. **Feedback triggers:** Which Effector effects should fire Sileo toasts? (e.g., markAsRead, delete, load failure, addNotification — or all of them?)
4. **Action toasts:** Should `actionUrl`/`actionText` on notifications surface as Sileo action buttons in the toast?
5. **Dark mode:** Does the app have a dark mode? If so, how should Sileo toasts be styled?
