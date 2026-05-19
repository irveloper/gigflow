"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, Loader2, ChevronRight } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"

type LogEntry = {
  id: string
  email: string
  outcome: string
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
}

const PAGE_SIZE = 50

export default function SecuritySettingsPage() {
  const [items, setItems] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(nextOffset: number) {
    setLoading(true)
    try {
      const result = await trpc.admin.listLoginHistory.query({ limit: PAGE_SIZE, offset: nextOffset })
      if (nextOffset === 0) {
        setItems(result.items)
      } else {
        setItems((prev) => [...prev, ...result.items])
      }
      setTotal(result.total)
      setOffset(nextOffset)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load login history")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="text-muted-foreground">Recent login activity for your organization.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Login history
          </CardTitle>
          <CardDescription>
            {total > 0 ? `${total} login attempts` : "No login activity yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {items.length === 0 && !loading && !error && (
            <p className="text-sm text-muted-foreground py-4 text-center">No login events recorded.</p>
          )}
          <div className="divide-y">
            {items.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{log.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(log.timestamp).toLocaleString()} · {log.ipAddress ?? "unknown IP"}
                  </p>
                </div>
                <Badge
                  variant={log.outcome === "success" ? "default" : "destructive"}
                  className="ml-3 shrink-0"
                >
                  {log.outcome}
                </Badge>
              </div>
            ))}
          </div>

          {items.length < total && (
            <Button
              variant="ghost"
              className="w-full mt-2"
              onClick={() => load(offset + PAGE_SIZE)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Load more
            </Button>
          )}

          {loading && items.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
