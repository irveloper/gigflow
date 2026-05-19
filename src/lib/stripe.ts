import Stripe from "stripe"
import { env } from "@/lib/env"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
})

export const PLANS = {
  starter: {
    name: "Starter",
    seatLimit: 3,
    monthly: env.STRIPE_PRICE_STARTER_MONTHLY,
    annual: env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  growth: {
    name: "Growth",
    seatLimit: 10,
    monthly: env.STRIPE_PRICE_GROWTH_MONTHLY,
    annual: env.STRIPE_PRICE_GROWTH_ANNUAL,
  },
  pro: {
    name: "Pro",
    seatLimit: 25,
    monthly: env.STRIPE_PRICE_PRO_MONTHLY,
    annual: env.STRIPE_PRICE_PRO_ANNUAL,
  },
} as const

export type PlanKey = keyof typeof PLANS

/** Derive seat limit from a Stripe price ID. Falls back to 3 (Starter). */
export function seatLimitForPrice(priceId: string): number {
  for (const plan of Object.values(PLANS)) {
    if (priceId === plan.monthly || priceId === plan.annual) {
      return plan.seatLimit
    }
  }
  return 3
}
