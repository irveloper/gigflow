# Next.js Integration

This skill assumes Next.js App Router.

## Default Mode For This Repo

Use Effector from client components and keep route files thin.

That means:

- route files decide shell/composition
- widgets/features render the screen
- `useUnit` lives in client components
- no server component should directly subscribe to Effector stores

## When To Keep It Simple

Stay with the current client-side model when:

- the route does not need server-preloaded Effector state
- auth is already handled client-side for that surface
- the task is local UI behavior or a small feature
- introducing scoped hydration would be disproportionate

## When To Use Scoped SSR

Use official Effector Next integration only when the task explicitly needs:

- per-request store isolation
- server preloading into stores
- serialized store hydration on first paint
- the same model graph on server and client

If you take that path, treat it as a deliberate architecture change and follow the official libraries and docs rather than inventing a custom hydration layer.

Sources to consult:

- FSD Next.js guide: `https://feature-sliced.design/docs/guides/tech/with-nextjs`
- Effector Next integration docs: `https://effector.dev/en/recipes/nextjs/integrate/`

## App Router Practical Rules

- Keep server-only logic in server files.
- Keep `use client` boundaries narrow.
- If a route becomes a large client page, extract a widget or feature screen component instead of growing the route file.
- Do not move business logic into server components just because the route is server-rendered.

## Migration Rule

Do not introduce `src/app` or `src/pages` in this repo unless the user explicitly asks for a structural migration. The current repo convention is project-root layers plus root `app/`.
