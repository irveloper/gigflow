"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"

type Metrics = {
  active: number
  trialing: number
  suspended: number
  canceled: number
  totalUsers: number
}

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const orgs = await trpc.organizations.listAll.query()

        const counts = orgs.reduce(
          (acc, org) => {
            const status = (org.status ?? "active") as string
            if (status === "active") acc.active++
            else if (status === "trialing") acc.trialing++
            else if (status === "suspended") acc.suspended++
            else if (status === "canceled") acc.canceled++
            acc.totalUsers += org.counts.users
            return acc
          },
          { active: 0, trialing: 0, suspended: 0, canceled: 0, totalUsers: 0 },
        )

        setMetrics(counts)
      } catch {
        // Silently fail — metrics are non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stat = (label: string, value: number | undefined, icon: React.ReactNode, color: string) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${color} flex items-center gap-2`}>
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          {loading ? "—" : (value ?? 0)}
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform-wide metrics</p>
        </div>
        <Link href="/superadmin/organizations" className="text-sm text-blue-600 hover:underline">
          View all organizations →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stat("Active orgs", metrics?.active, <CheckCircle className="h-4 w-4" />, "text-green-600")}
        {stat("Trialing", metrics?.trialing, <Clock className="h-4 w-4" />, "text-blue-600")}
        {stat("Suspended", metrics?.suspended, <AlertCircle className="h-4 w-4" />, "text-yellow-600")}
        {stat("Canceled", metrics?.canceled, <XCircle className="h-4 w-4" />, "text-red-600")}
        {stat("Total users", metrics?.totalUsers, <Users className="h-4 w-4" />, "text-purple-600")}
      </div>
    </div>
  )
}
