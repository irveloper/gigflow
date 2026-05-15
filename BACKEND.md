# Backend Setup & Deployment

## Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 16 (Docker locally, managed Postgres in production) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | NextAuth v5 (credentials provider, JWT sessions) |
| API | tRPC v11 over Next.js Route Handlers |
| File storage | AWS S3 (check-in photos) |
| Error tracking | Sentry (`@sentry/nextjs`) |

---

## Local Development

### Prerequisites

- Docker Desktop
- Node.js (LTS) and pnpm

### 1. Start the database

```bash
docker compose up -d
```

Starts a PostgreSQL 16 container on port 5432:
- User: `postgres`, Password: `postgres`, Database: `plugin_cancun`

### 2. Copy environment variables

```bash
cp .env.local.example .env.local
```

Fill in required values (see **Environment Variables** below). For local dev, `DATABASE_URL` and `NEXTAUTH_SECRET` are the critical ones.

### 3. Run database migrations

```bash
pnpm db:migrate
```

Runs `prisma migrate deploy` — applies all migrations in `prisma/migrations/` in order.

### 4. Seed demo data

```bash
pnpm db:seed
```

Seeds demo users, musicians, hotels, events, and notifications. Safe to run multiple times (idempotent upserts).

### Demo users (all passwords: `123456`)

| Email | Role |
|-------|------|
| `gerente@test.com` | Manager |
| `musico@test.com` | Musician |
| `ana@test.com` | Musician |
| `hotel@test.com` | Hotel |

### 5. Run the app

```bash
pnpm dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | App base URL — `http://localhost:3000` locally, full domain in production |
| `AWS_REGION` | Yes | S3 bucket region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Yes | IAM user access key — needs `s3:PutObject` on the bucket |
| `AWS_SECRET_ACCESS_KEY` | Yes | IAM user secret key |
| `AWS_S3_BUCKET` | Yes | S3 bucket name for check-in photo uploads |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN for client-side error tracking |
| `SENTRY_DSN` | No | Sentry DSN for server-side error tracking |
| `SENTRY_AUTH_TOKEN` | No | Used by CI to upload source maps to Sentry |

---

## Role-Based Access Control

Roles stored in `users.role`. Enforced at the **tRPC layer** via procedure guards in `server/trpc.ts`:

| Procedure | Who can call it |
|-----------|----------------|
| `publicProcedure` | Anyone (unauthenticated) |
| `protectedProcedure` | Any authenticated user |
| `managerProcedure` | `role = "manager"` only |
| `musicianProcedure` | `role = "musician"` only |
| `hotelProcedure` | `role = "hotel"` only |

### Role assignment flow

1. User registers → `role = null` (pending)
2. User sees "Pending Role Assignment" screen after login
3. Manager visits `/admin/users` → assigns role
4. User refreshes → full access granted

Managers cannot self-register. The first manager must be seeded via `pnpm db:seed`. Subsequent managers are created by existing managers via the admin panel.

---

## AWS S3 Setup (check-in photos)

1. Create an S3 bucket (e.g. `plugin-cancun-checkins`)
2. Create an IAM user with this policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::plugin-cancun-checkins/*"
       }
     ]
   }
   ```
3. Generate access keys for the IAM user
4. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` in your env

Photos are uploaded server-side (via `/api/upload/checkin-photo`) — no browser-to-S3 direct upload, no CORS configuration needed.

---

## Database Migrations

```bash
# Create a new migration (local dev only)
npx prisma migrate dev --name <description>

# Apply existing migrations (production / CI)
pnpm db:migrate

# Reset DB and re-seed (local dev only — destructive)
npx prisma migrate reset
```

Migrations live in `prisma/migrations/`. Never edit an existing migration — create a new one.

---

## tRPC API

Router at `server/routers/index.ts`. Served at `/api/trpc/[trpc]`.

| Router | Procedures |
|--------|-----------|
| `auth` | `register`, `me` |
| `events` | `getAll`, `getById`, `create`, `update`, `delete`, `checkIn` |
| `musicians` | `getAll`, `create`, `update`, `delete` |
| `hotels` | `getAll`, `create`, `update`, `delete` |
| `notifications` | `getAll`, `markRead`, `markAllRead` |
| `admin` | `listUsers`, `createUser`, `deactivateUser` |

---

## Production Deployment (Vercel)

1. Set all environment variables in Vercel project settings (including `NEXTAUTH_URL` = your prod domain)
2. Push to `main` — Vercel auto-deploys
3. Run migrations against production DB:
   ```bash
   DATABASE_URL=<prod-url> pnpm db:migrate
   ```
4. Seed on first deploy (optional — for demo data):
   ```bash
   DATABASE_URL=<prod-url> pnpm db:seed
   ```
