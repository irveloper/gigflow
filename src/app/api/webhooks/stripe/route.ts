import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import Stripe from "stripe"
import { stripe, seatLimitForPrice } from "@/lib/stripe"
import { env } from "@/lib/env"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Disable body parsing so we can read the raw bytes for signature verification.
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    await handleEvent(event)
  } catch (err) {
    // Log but return 200 so Stripe doesn't retry indefinitely for logic errors.
    // Re-throw only on transient errors (DB unavailable etc.) would need more nuance.
    console.error("[stripe-webhook] handler error", event.type, err)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== "subscription") break

      const stripeCustomerId = session.customer as string
      const stripeSubscriptionId = session.subscription as string
      const orgSlug = session.metadata?.orgSlug
      const orgName = session.metadata?.orgName

      if (!orgSlug || !orgName) {
        console.error("[stripe-webhook] checkout.session.completed missing metadata", session.id)
        break
      }

      // Retrieve subscription to get price and trial info
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
      const priceId = sub.items.data[0]?.price.id ?? null
      const seatLimit = priceId ? seatLimitForPrice(priceId) : 3

      // Create org if it doesn't exist yet (self-serve flow creates it here)
      const org = await prisma.organization.upsert({
        where: { slug: orgSlug },
        update: { status: sub.status === "trialing" ? "trialing" : "active" },
        create: { name: orgName, slug: orgSlug, status: sub.status === "trialing" ? "trialing" : "active" },
      })

      await prisma.subscription.upsert({
        where: { stripeCustomerId },
        update: {
          stripeSubscriptionId,
          stripePriceId: priceId,
          status: sub.status,
          seatLimit,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
        create: {
          organizationId: org.id,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: priceId,
          status: sub.status,
          seatLimit,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      })

      // Assign creator as manager if userId is in metadata
      const userId = session.metadata?.userId
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { organizationId: org.id, role: "manager" },
        })
      }

      console.log("[stripe-webhook] org activated", org.slug)
      break
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id ?? null
      const seatLimit = priceId ? seatLimitForPrice(priceId) : 3

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          stripePriceId: priceId,
          status: sub.status,
          seatLimit,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      })

      // Sync org status to match subscription status
      const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: sub.id },
        select: { organizationId: true },
      })
      if (dbSub) {
        const orgStatus = sub.status === "trialing" ? "trialing"
          : sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : "suspended"
        await prisma.organization.update({
          where: { id: dbSub.organizationId },
          data: { status: orgStatus },
        })
      }
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription

      const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: sub.id },
        select: { organizationId: true },
      })

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "suspended", cancelAtPeriodEnd: false },
      })

      if (dbSub) {
        await prisma.organization.update({
          where: { id: dbSub.organizationId },
          data: { status: "suspended" },
        })
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id

      if (!stripeSubscriptionId) break

      const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId },
        select: { organizationId: true },
      })

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: { status: "past_due" },
      })

      if (dbSub) {
        await prisma.organization.update({
          where: { id: dbSub.organizationId },
          data: { status: "past_due" },
        })
      }
      break
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id

      if (!stripeSubscriptionId) break

      const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId },
        select: { organizationId: true, status: true },
      })

      // Only recover from past_due — don't overwrite trialing/canceled
      if (dbSub?.status === "past_due") {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: { status: "active" },
        })
        await prisma.organization.update({
          where: { id: dbSub.organizationId },
          data: { status: "active" },
        })
      }
      break
    }

    default:
      // Ignore unhandled event types
      break
  }
}
