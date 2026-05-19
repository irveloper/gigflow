# Runbook — PlugIn Cancún SaaS

## Prerequisites

- Node.js 20+, pnpm 9+
- PostgreSQL 15+ (Vercel Postgres or self-hosted)
- Stripe account (live keys + webhook endpoint)
- Resend account (transactional email)
- AWS S3 bucket (check-in photo uploads)
- Optional: Upstash Redis (distributed rate limiting)
- Optional: Sentry project (error monitoring)

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | 32-byte random secret (`openssl rand -hex 32`) |
| `NEXTAUTH_URL` | Public app URL (e.g. `https://app.plugincancun.com`) |
| `AWS_REGION` | S3 region |
| `AWS_ACCESS_KEY_ID` | S3 IAM access key |
| `AWS_SECRET_ACCESS_KEY` | S3 IAM secret |
| `AWS_S3_BUCKET` | S3 bucket name |
| `STRIPE_SECRET_KEY` | Stripe server-side key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) |
| `STRIPE_PRICE_STARTER_MONTHLY` | Stripe Price ID for Starter monthly |
| `STRIPE_PRICE_STARTER_ANNUAL` | Stripe Price ID for Starter annual |
| `STRIPE_PRICE_GROWTH_MONTHLY` | Stripe Price ID for Growth monthly |
| `STRIPE_PRICE_GROWTH_ANNUAL` | Stripe Price ID for Growth annual |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro monthly |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Price ID for Pro annual |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender address (e.g. `noreply@plugincancun.com`) |
| `UPSTASH_REDIS_REST_URL` | (optional) Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | (optional) Upstash Redis token |
| `SENTRY_DSN` | (optional) Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | (optional) Sentry DSN (client-side) |

---

## First Deployment (Vercel)

1. **Create Vercel project** — import the GitHub repo.
2. **Add all env vars** in Vercel → Settings → Environment Variables.
3. **Set up Vercel Postgres** or point `DATABASE_URL` to an external DB.
4. **Run migrations**:
   ```bash
   pnpm db:migrate
   ```
5. **Seed production data** (optional for initial superadmin):
   ```bash
   pnpm db:seed
   ```
6. **Register Stripe webhook** (see below).
7. **Deploy** — Vercel auto-deploys on push to `main`.

---

## Database Migration Procedure

```bash
# Run all pending migrations against the target DB
DATABASE_URL="postgres://..." pnpm db:migrate

# Verify: check migration history
DATABASE_URL="postgres://..." npx prisma migrate status
```

> **Before migrating production:** take a DB snapshot/backup.

---

## Stripe Webhook Registration

1. In Stripe dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://<your-domain>/api/webhooks/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`.

To test locally:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Post-Deploy Checklist

- [ ] `DATABASE_URL` migration ran successfully
- [ ] Stripe webhook endpoint registered + secret set
- [ ] Test org creation flow (Checkout → webhook → org created)
- [ ] Test email delivery (register a user, check inbox)
- [ ] S3 upload works (check-in photo endpoint)
- [ ] Sentry captures a test error
- [ ] Superadmin dashboard loads metrics
- [ ] `/billing-suspended` page renders correctly for suspended orgs

---

## Rollback Procedure

1. **Vercel rollback**: Deployments tab → select previous deploy → "Promote to Production".
2. **DB rollback**: If migration introduced a breaking change:
   ```bash
   # Restore from snapshot (Vercel Postgres: restore from backup in dashboard)
   # For self-hosted: pg_restore from pre-migration backup
   ```
   > There is no automated "down" migration. Schema changes should be backward-compatible.

---

## Secret Rotation Guide

### NEXTAUTH_SECRET
Rotating invalidates all active sessions — all users are logged out.
1. Generate new secret: `openssl rand -hex 32`
2. Update in Vercel env vars → redeploy.

### Stripe Keys
1. Generate new restricted key in Stripe dashboard.
2. Update `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel.
3. Re-register webhook and update `STRIPE_WEBHOOK_SECRET`.

### Database Password
1. Rotate in DB provider dashboard.
2. Update `DATABASE_URL` in Vercel.
3. Redeploy to apply.

### Resend API Key
1. Rotate in Resend dashboard.
2. Update `RESEND_API_KEY` in Vercel.

---

## Monitoring & Alerts

- **Sentry**: errors stream to configured DSN. `tracesSampleRate: 0.2` in production.
- **Vercel Analytics**: page views and performance via Vercel dashboard.
- **Stripe**: payment failures emit `invoice.payment_failed` — subscription status set to `past_due`.
- **Superadmin dashboard** (`/superadmin`): live org counts by status.
