"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Users, Calendar, ExternalLink, Loader2 } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"
import type { Subscription } from "@/shared/types"

const PLAN_NAME_BY_SEAT: Record<number, string> = {
  3: "Starter",
  10: "Growth",
  25: "Pro",
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  trialing: { label: "Trial", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  past_due: { label: "Past due", variant: "destructive" },
  suspended: { label: "Suspended", variant: "destructive" },
  canceled: { label: "Canceled", variant: "outline" },
}

export default function BillingSettingsPage() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [seatUsage, setSeatUsage] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [subscription, users] = await Promise.all([
          trpc.billing.getSubscription.query(),
          trpc.admin.listUsers.query({ limit: 200, offset: 0 }),
        ])
        setSub(subscription)
        setSeatUsage(users.items.filter((u) => u.isActive).length)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load billing info")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleManageBilling() {
    setPortalLoading(true)
    try {
      const { url } = await trpc.billing.createPortalSession.mutate()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal")
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !sub) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {error ?? "No subscription found."}
      </div>
    )
  }

  const planName = PLAN_NAME_BY_SEAT[sub.seatLimit] ?? `${sub.seatLimit}-seat plan`
  const statusInfo = STATUS_BADGE[sub.status] ?? { label: sub.status, variant: "outline" as const }
  const periodEnd = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null
  const trialEnd = sub.trialEndsAt
    ? new Date(sub.trialEndsAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and payment method.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            Current plan
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </CardTitle>
          <CardDescription>{planName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Seat usage</p>
                <p className="text-muted-foreground">
                  {seatUsage ?? "—"} / {sub.seatLimit} members
                </p>
              </div>
            </div>

            {sub.status === "trialing" && trialEnd && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Trial ends</p>
                  <p className="text-muted-foreground">{trialEnd}</p>
                </div>
              </div>
            )}

            {sub.status !== "trialing" && periodEnd && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {sub.cancelAtPeriodEnd ? "Access until" : "Next billing date"}
                  </p>
                  <p className="text-muted-foreground">{periodEnd}</p>
                </div>
              </div>
            )}
          </div>

          {sub.status === "past_due" && (
            <p className="text-sm text-destructive">
              Your last payment failed. Update your payment method to restore full access.
            </p>
          )}

          {sub.status === "suspended" && (
            <p className="text-sm text-destructive">
              Your subscription is suspended. Reactivate to regain access.
            </p>
          )}

          <Button
            onClick={handleManageBilling}
            disabled={portalLoading}
            className="w-full"
            variant="outline"
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Manage billing
            <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-60" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
