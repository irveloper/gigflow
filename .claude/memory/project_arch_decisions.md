---
name: Architecture Decisions
description: Confirmed tech stack choices — Prisma over Supabase SDK, NextAuth for auth, Effector stays
type: project
---

User confirmed the target architecture for the T3 stack completion:

- **ORM**: Prisma (not Supabase JS SDK direct). Supabase Postgres is still the DB, but access goes through Prisma, not `supabase.from()`.
- **Auth**: NextAuth.js (replacing the current localStorage/cookie hack). NOT Supabase GoTrue/Auth.
- **State**: Effector stays as the client state layer (intentional — replaces React Query).
- **API**: tRPC stays as the API layer. tRPC routers will call Prisma, not Supabase SDK.

**Why:** User prefers Prisma's type-safe ORM interface and NextAuth's flexibility over the Supabase-native approach described in BACKEND.md.

**How to apply:** When implementing DB queries in tRPC routers, use `prisma.*` not `supabase.from()`. When implementing auth, use NextAuth session/JWT, not Supabase GoTrue. Do NOT suggest switching to Supabase Auth or Supabase JS SDK for data fetching.
