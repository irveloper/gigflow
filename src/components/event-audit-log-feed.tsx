"use client"

import { useState, useEffect } from "react"
import { trpc } from "@/shared/lib/trpc"
import type { EventAuditLog, EventAuditLogAction } from "@/shared/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus,
  RefreshCw,
  User,
  Music,
  LogIn,
  CheckCircle,
  XCircle,
  ArrowLeftRight,
  Pencil,
  DollarSign,
  Trash2,
  Bell,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<EventAuditLogAction, string> = {
  EVENT_CREATED: "Event created",
  MUSICIAN_ASSIGNED: "Musician assigned",
  MUSICIAN_CHANGED: "Musician changed",
  MUSICIAN_REMOVED: "Musician removed",
  BAND_ASSIGNED: "Band assigned",
  BAND_CHANGED: "Band changed",
  BAND_REMOVED: "Band removed",
  INVITATION_SENT: "Invitation sent",
  INVITATION_READ: "Invitation read",
  CHECK_IN_RECORDED: "Check-in recorded",
  CHECK_IN_CONFIRMED: "Check-in confirmed",
  CHECK_IN_REJECTED: "Check-in rejected",
  STATUS_CHANGED: "Status changed",
  SETS_CHANGE: "Sets changed",
  FIELD_UPDATED: "Field updated",
  PRICE_CHANGED: "Price changed",
  EVENT_DELETED: "Event deleted",
  PAYMENT_STATUS_CHANGED: "Payment status changed",
}

type ActionColor = "green" | "red" | "blue" | "gray" | "purple"

const ACTION_COLOR: Record<EventAuditLogAction, ActionColor> = {
  EVENT_CREATED: "green",
  MUSICIAN_ASSIGNED: "green",
  MUSICIAN_CHANGED: "blue",
  MUSICIAN_REMOVED: "red",
  BAND_ASSIGNED: "green",
  BAND_CHANGED: "blue",
  BAND_REMOVED: "red",
  INVITATION_SENT: "blue",
  INVITATION_READ: "gray",
  CHECK_IN_RECORDED: "blue",
  CHECK_IN_CONFIRMED: "green",
  CHECK_IN_REJECTED: "red",
  STATUS_CHANGED: "gray",
  SETS_CHANGE: "blue",
  FIELD_UPDATED: "gray",
  PRICE_CHANGED: "purple",
  EVENT_DELETED: "red",
  PAYMENT_STATUS_CHANGED: "purple",
}

const COLOR_CLASSES: Record<ActionColor, string> = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-600",
  purple: "bg-purple-100 text-purple-700",
}

const ROLE_BADGE: Record<string, string> = {
  manager: "bg-blue-100 text-blue-700",
  musician: "bg-purple-100 text-purple-700",
  system: "bg-gray-100 text-gray-500",
}

function ActionIcon({ action }: { action: EventAuditLogAction }) {
  const icons: Record<EventAuditLogAction, React.ReactNode> = {
    EVENT_CREATED: <Plus className="h-3.5 w-3.5" />,
    MUSICIAN_ASSIGNED: <Music className="h-3.5 w-3.5" />,
    MUSICIAN_CHANGED: <ArrowLeftRight className="h-3.5 w-3.5" />,
    MUSICIAN_REMOVED: <XCircle className="h-3.5 w-3.5" />,
    BAND_ASSIGNED: <Music className="h-3.5 w-3.5" />,
    BAND_CHANGED: <ArrowLeftRight className="h-3.5 w-3.5" />,
    BAND_REMOVED: <XCircle className="h-3.5 w-3.5" />,
    INVITATION_SENT: <Bell className="h-3.5 w-3.5" />,
    INVITATION_READ: <Eye className="h-3.5 w-3.5" />,
    CHECK_IN_RECORDED: <LogIn className="h-3.5 w-3.5" />,
    CHECK_IN_CONFIRMED: <CheckCircle className="h-3.5 w-3.5" />,
    CHECK_IN_REJECTED: <XCircle className="h-3.5 w-3.5" />,
    STATUS_CHANGED: <RefreshCw className="h-3.5 w-3.5" />,
    SETS_CHANGE: <ArrowLeftRight className="h-3.5 w-3.5" />,
    FIELD_UPDATED: <Pencil className="h-3.5 w-3.5" />,
    PRICE_CHANGED: <DollarSign className="h-3.5 w-3.5" />,
    EVENT_DELETED: <Trash2 className="h-3.5 w-3.5" />,
    PAYMENT_STATUS_CHANGED: <DollarSign className="h-3.5 w-3.5" />,
  }
  return <>{icons[action]}</>
}

// ---------------------------------------------------------------------------
// Detail string builder
// ---------------------------------------------------------------------------

type Metadata = Record<string, unknown>

function buildDetail(action: EventAuditLogAction, metadata: Metadata | null): string {
  if (!metadata) return ""
  switch (action) {
    case "EVENT_CREATED":
      return `Title: "${metadata.title}"`
    case "MUSICIAN_ASSIGNED":
      return `Musician: ${(metadata.to as { musicianName?: string })?.musicianName ?? "—"}`
    case "MUSICIAN_CHANGED": {
      const from = metadata.from as { musicianName?: string } | null
      const to = metadata.to as { musicianName?: string } | null
      return `${from?.musicianName ?? "—"} → ${to?.musicianName ?? "—"}`
    }
    case "MUSICIAN_REMOVED":
      return `Removed: ${(metadata.from as { musicianName?: string })?.musicianName ?? "—"}`
    case "BAND_ASSIGNED":
      return `Band: ${(metadata.to as { bandName?: string })?.bandName ?? "—"}`
    case "BAND_CHANGED": {
      const from = metadata.from as { bandName?: string } | null
      const to = metadata.to as { bandName?: string } | null
      return `${from?.bandName ?? "—"} → ${to?.bandName ?? "—"}`
    }
    case "BAND_REMOVED":
      return `Removed: ${(metadata.from as { bandName?: string })?.bandName ?? "—"}`
    case "INVITATION_SENT":
      return "Invitation dispatched to musician"
    case "INVITATION_READ":
      return "Musician read the invitation"
    case "CHECK_IN_RECORDED": {
      const time = metadata.time ? new Date(metadata.time as string).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"
      return `Check-in at ${time}`
    }
    case "CHECK_IN_CONFIRMED":
      return "Check-in approved"
    case "CHECK_IN_REJECTED":
      return "Check-in rejected — reverted to Scheduled"
    case "STATUS_CHANGED":
      return `${metadata.from} → ${metadata.to}`
    case "FIELD_UPDATED":
      return `${metadata.field}: "${metadata.from}" → "${metadata.to}"`
    case "PRICE_CHANGED":
      return `${metadata.from === null ? "not set" : `$${metadata.from}`} → ${metadata.to === null ? "not set" : `$${metadata.to}`}`
    case "EVENT_DELETED":
      return `"${metadata.title}" deleted`
    case "PAYMENT_STATUS_CHANGED":
      return `${metadata.from} → ${metadata.to}${metadata.notes ? ` (${metadata.notes})` : ""}`
    default:
      return ""
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

// ---------------------------------------------------------------------------
// Single entry
// ---------------------------------------------------------------------------

function AuditLogEntry({ entry }: { entry: EventAuditLog }) {
  const color = ACTION_COLOR[entry.action]
  const detail = buildDetail(entry.action, entry.metadata)

  return (
    <div className="flex gap-3 items-start py-3 border-b last:border-0">
      <div className={`mt-0.5 flex-shrink-0 rounded-full p-1.5 ${COLOR_CLASSES[color]}`}>
        <ActionIcon action={entry.action} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{ACTION_LABELS[entry.action]}</span>
          {detail && <span className="text-sm text-gray-500 truncate">{detail}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <User className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">{entry.actorName}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[entry.actorRole] ?? ROLE_BADGE.system}`}>
            {entry.actorRole}
          </span>
        </div>
      </div>
      <span className="flex-shrink-0 text-xs text-gray-400 mt-0.5">{formatRelativeTime(entry.timestamp)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

interface EventAuditLogFeedProps {
  eventId: string
}

export function EventAuditLogFeed({ eventId }: EventAuditLogFeedProps) {
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState<EventAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    trpc.eventAuditLogs.list
      .query({ eventId, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message ?? "Failed to load audit log")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [eventId, offset])

  const start = offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600 text-sm">{error}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No audit entries yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((entry) => (
            <AuditLogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
          <span>Showing {start}–{end} of {total}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={end >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
