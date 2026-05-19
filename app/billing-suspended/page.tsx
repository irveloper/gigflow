"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CreditCard, Loader2 } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"

export default function BillingSuspendedPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReactivate() {
    setLoading(true)
    setError(null)
    try {
      const { url } = await trpc.billing.createPortalSession.mutate()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle>Subscription inactive</CardTitle>
          <CardDescription>
            Your organization&apos;s subscription has expired or been suspended. Reactivate to
            continue using the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={handleReactivate} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Manage billing
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Your data is safe and will be restored immediately upon reactivation.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
