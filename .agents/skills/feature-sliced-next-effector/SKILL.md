---
name: feature-sliced-next-effector
description: Use when implementing or refactoring Feature-Sliced Design in this repo with Next.js App Router and Effector. Covers slice placement, layer boundaries, public API rules, feature isolation, Effector model ownership, segment structure, cross-feature coordination, and the mandatory spec-driven workflow. Triggers on "Feature-Sliced Design", "FSD", "slice this feature", "where should this code live", "Next.js + Effector", "Effector architecture", "refactor layers", "move logic between shared/entities/features/widgets/app".
---

# Feature-Sliced Next.js + Effector

Use this skill for architectural work in this repo. It is tuned to:

- Next.js `app/` router
- Effector + `effector-react`
- project-root layers (`app`, `shared`, `entities`, `features`, `widgets`)
- mandatory spec-driven development from `AGENTS.md`

## Start Here

Before editing runtime code, follow the repo's required spec-driven flow:

1. Update `specs/entities/*.schema.ts` first when data shape changes.
2. Add or update typed fixtures in `specs/fixtures/`.
3. Add or update behavior in `specs/features/*.scenarios.ts`.
4. Only then edit `entities/*/model.ts`, `features/*/model.ts`, tests, and route/UI files.

Do not introduce handwritten domain `interface` or `type` declarations. Types come from `z.infer` on schema files. `shared/types` is only a compatibility barrel re-exporting from `specs/entities`.

---

## Layer Rules

```
shared/ ← entities/ ← features/ ← widgets/ ← app/
```

Each layer may only import from layers to its left. Violations are bugs.

| Layer | Owns | May import from |
|-------|------|----------------|
| `shared/` | framework-agnostic utils, API clients, formatters, UI primitives | nothing in this repo |
| `entities/` | domain state, domain transformations, entity UI | `shared/` |
| `features/` | user actions, async flows, cross-entity orchestration | `shared/`, `entities/` |
| `widgets/` | composed page sections, UI orchestration | `shared/`, `entities/`, `features/` |
| `app/` | routes, layouts, providers, bootstrap, framework integration | everything |

Read [placement.md](./references/placement.md) for per-concept examples.

---

## CRITICAL: Feature Isolation

**Features must not import from other features.**

This is the most commonly violated FSD rule. Each feature slice is independent.

```ts
// WRONG — features/check-in importing from features/events
import { checkIn } from "@/features/events/model"
import { addNotification } from "@/features/notifications/model"

// RIGHT — import entity primitives instead
import { updateEventById } from "@/entities/event/model"
import { upsertNotification } from "@/entities/notification/model"
```

When two features need to coordinate, choose one of these patterns:

1. **Use entity primitives** — entity stores expose primitive setters that any feature can use.
2. **App-layer coordination** — wire cross-feature logic in `app/providers.tsx` or a root layout using `sample`.
3. **Shared event bus** — define a coordination event in `shared/lib/` that both features can import.

Pattern 1 (entity primitives) is correct for this repo in almost every case.

---

## CRITICAL: Public API via index.ts

**Each slice must expose its public surface through an `index.ts` barrel.**  
**Never import from a slice's internal segment path from outside that slice.**

```ts
// WRONG — importing internal segment directly
import { $events } from "@/entities/event/model"
import { loadEvents } from "@/features/events/model"

// RIGHT — importing from slice public API
import { $events } from "@/entities/event"
import { loadEvents } from "@/features/events"
```

The `index.ts` is the contract between the slice and everything above it. Internal segments (`model.ts`, `ui/`, `api.ts`) are private implementation.

Within the same slice, files may import each other freely — e.g., `features/events/model.ts` may import directly from `entities/event/model.ts` because it is the slice owner doing internal work.

**Current state of this repo:** Public API index files are not yet created for all slices. Add them as slices are worked on — do not do a mass rewrite unless the task is a dedicated cleanup.

---

## Segment Structure

Each slice should organize code into segments:

```
entities/event/
  index.ts       ← public API (mandatory)
  model.ts       ← stores, events, derived stores
  ui/            ← entity-specific UI: EventCard, EventBadge, EventAvatar
  api.ts         ← API calls specific to this entity (when real API exists)
  lib.ts         ← entity-specific helpers (date math, status utilities)

features/events/
  index.ts       ← public API (mandatory)
  model.ts       ← effects, intent events, pending/error state, sample wiring
  ui/            ← feature-owned UI: EventForm, CheckInButton (if complex enough)

widgets/navigation/
  index.ts       ← public API
  ui.tsx         ← composed navigation UI
```

Segments are not mandatory at day 1 — start with `model.ts` and `ui.tsx`. Add segments when a file grows or responsibility splits. Do not create empty segment directories speculatively.

---

## Effector Rules

Prefer these patterns:

- Entity stores hold durable business data. Feature effects update them via entity primitive events.
- Use `sample` to connect `intent event → effect → entity setter`.
- Keep `pending`, `error`, and `isLoading` in features, not entities.
- Keep derived stores close to the store they derive from (entity model is the right place for `$todayEvents` if it derives from `$events`).
- Do not call effects directly from React — dispatch intent events instead.
- Avoid `watch` for app logic. Use declarative graph wiring.
- Use `useUnit` in client components only.

Read [effector-patterns.md](./references/effector-patterns.md) for concrete examples.

---

## Next.js Integration

- Route files in `app/` are thin shells. They compose widgets and providers.
- Business logic and store wiring belong in slices, not route files.
- `useUnit` lives in client components. Server components do not subscribe to Effector stores.
- Do not add SSR hydration for Effector stores unless the task explicitly requires per-request isolation.

Read [nextjs-integration.md](./references/nextjs-integration.md) before implementing scoped SSR or hydration.

---

## Repo Defaults

- FSD layers at project root. Do not introduce `src/` casually.
- Next route entries in root `app/`.
- Pages are thin — they import from `widgets/` or `features/`, they do not own business logic.
- When a route file grows large, extract a widget instead.

---

## Architectural Smells

These indicate a violation:

| Smell | Likely fix |
|-------|-----------|
| Feature imports from another feature | Use entity primitives or app-layer coordination |
| Import from `entities/event/model` (internal path) from outside the slice | Create `entities/event/index.ts` and import from there |
| Entity store exists only for one form's pending state | Move to feature |
| `shared/` imports from `entities/`, `features/`, or `app/` | Move to a slice |
| Route file does business filtering or runs effect logic | Extract to widget or feature model |
| Dead exported events that are never sampled | Delete |
| Entity re-exporting from a feature | Fix — entity should not know about features |

---

## Output Expectations

When using this skill, bias toward:

- clear layer placement with no upward imports
- feature isolation — features reference entity primitives, not each other
- slices expose public APIs via `index.ts`
- thin route files that compose widgets
- Effector graph that matches slice boundaries
- spec-first changes

If the task is a new feature, implement files in this order:

1. `specs/entities/*` — schema
2. `specs/fixtures/*` — deterministic data
3. `specs/features/*` — behavior scenarios
4. `entities/*/model.ts` + `entities/*/index.ts` — domain state
5. `features/*/model.ts` + `features/*/index.ts` — business logic
6. `widgets/*/` — composed UI sections
7. `app/*/` — route entry + providers
