"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Music, Users, Check } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    seats: 3,
    monthlyPrice: "$29",
    annualPrice: "$290",
    features: ["3 team members", "Unlimited events", "Check-in with photo", "Email notifications"],
    popular: false,
  },
  {
    key: "growth",
    name: "Growth",
    seats: 10,
    monthlyPrice: "$79",
    annualPrice: "$790",
    features: ["10 team members", "Unlimited events", "Check-in with photo", "Email notifications", "Login audit log"],
    popular: true,
  },
  {
    key: "pro",
    name: "Pro",
    seats: 25,
    monthlyPrice: "$199",
    annualPrice: "$1,990",
    features: ["25 team members", "Unlimited events", "Check-in with photo", "Email notifications", "Login audit log", "Priority support"],
    popular: false,
  },
] as const

export default function PlanSelectorPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly")
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<string>("growth")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  async function handleContinue() {
    if (!orgName.trim() || !orgSlug.trim()) {
      setError("Organization name and URL are required.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const priceEnvKey = `NEXT_PUBLIC_STRIPE_PRICE_${selectedPlan.toUpperCase()}_${billing.toUpperCase()}` as never
      const priceId = (process.env as Record<string, string | undefined>)[priceEnvKey]
      if (!priceId) {
        setError("Selected plan is not configured. Contact support.")
        setLoading(false)
        return
      }
      const result = await trpc.organizations.initiateCheckout.mutate({
        name: orgName.trim(),
        slug: orgSlug,
        priceId,
      })
      router.push(result.url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setError(message.includes("CONFLICT") ? "That URL is already taken. Try a different one." : message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Music className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Choose your plan</h1>
          <p className="text-muted-foreground mt-2">7-day free trial · Cancel anytime · Card required</p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 border rounded-full p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual <span className="text-xs opacity-70 ml-1">2 months free</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => (
            <Card
              key={plan.key}
              onClick={() => setSelectedPlan(plan.key)}
              className={`cursor-pointer transition-all relative ${selectedPlan === plan.key ? "border-primary ring-2 ring-primary" : "hover:border-muted-foreground"}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {selectedPlan === plan.key && <Check className="h-4 w-4 text-primary" />}
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {plan.seats} seats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4">
                  {billing === "monthly" ? plan.monthlyPrice : plan.annualPrice}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{billing === "monthly" ? "mo" : "yr"}
                  </span>
                </p>
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm flex items-start gap-1.5">
                      <Check className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Org details */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  placeholder="Sonidos del Mar"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value)
                    if (!orgSlug || orgSlug === toSlug(orgName)) {
                      setOrgSlug(toSlug(e.target.value))
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">URL</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">app/org/</span>
                  <Input
                    id="org-slug"
                    placeholder="sonidos-del-mar"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(toSlug(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive text-center mb-3">{error}</p>}

        <Button
          className="w-full"
          size="lg"
          onClick={handleContinue}
          disabled={loading || !orgName.trim() || !orgSlug.trim()}
        >
          {loading ? "Redirecting to checkout…" : "Continue to payment →"}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Secured by Stripe. You won&apos;t be charged during the 7-day trial.
        </p>
      </div>
    </div>
  )
}
