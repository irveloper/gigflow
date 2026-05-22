import type { PrismaClient } from "@prisma/client"
import type { EventAuditLogAction } from "@/entities/event-audit-log/schema"

export interface AuditEntry {
  eventId: string
  organizationId: string
  actorId?: string | null
  actorName: string
  actorRole: "manager" | "musician" | "system"
  action: EventAuditLogAction
  metadata?: Record<string, unknown> | null
}

export async function writeEventAuditEntry(
  prisma: PrismaClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    await prisma.eventAuditLog.create({
      data: {
        eventId: entry.eventId,
        organizationId: entry.organizationId,
        actorId: entry.actorId ?? null,
        actorName: entry.actorName,
        actorRole: entry.actorRole,
        action: entry.action,
        metadata: (entry.metadata ?? undefined) as object | undefined,
      },
    })
  } catch (e) {
    console.error("[audit] failed to write entry", { action: entry.action, eventId: entry.eventId, error: e })
  }
}

// ---------------------------------------------------------------------------
// Field diffing helpers
// ---------------------------------------------------------------------------

type EventSnapshot = {
  title?: string | null
  description?: string | null
  date?: string | null
  time?: string | null
  durationMinutes?: number | null
  hotel?: string | null
  hotelId?: string | null
  musician?: string | null
  musicianId?: string | null
  band?: string | null
  bandId?: string | null
  status?: string | null
  price?: number | null
}

export interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

/** Scalar fields tracked as FIELD_UPDATED (excludes performer and status — handled separately) */
const SCALAR_FIELDS: (keyof EventSnapshot)[] = [
  "title",
  "description",
  "date",
  "time",
  "durationMinutes",
  "hotel",
  "hotelId",
]

/**
 * Computes changed fields between existing event and incoming update data.
 * Returns separate arrays for musician changes, band changes, status change,
 * price change, and generic scalar field changes.
 */
export function diffEventFields(
  existing: EventSnapshot,
  update: EventSnapshot,
): {
  musicianChange: FieldChange | null
  bandChange: FieldChange | null
  statusChange: FieldChange | null
  priceChange: FieldChange | null
  fieldChanges: FieldChange[]
} {
  let musicianChange: FieldChange | null = null
  let bandChange: FieldChange | null = null
  let statusChange: FieldChange | null = null
  let priceChange: FieldChange | null = null
  const fieldChanges: FieldChange[] = []

  // Musician change
  if ("musicianId" in update && update.musicianId !== existing.musicianId) {
    musicianChange = {
      field: "musicianId",
      from: existing.musicianId ?? null,
      to: update.musicianId ?? null,
    }
  }

  // Band change
  if ("bandId" in update && update.bandId !== existing.bandId) {
    bandChange = {
      field: "bandId",
      from: existing.bandId ?? null,
      to: update.bandId ?? null,
    }
  }

  // Status change
  if ("status" in update && update.status !== undefined && update.status !== existing.status) {
    statusChange = { field: "status", from: existing.status, to: update.status }
  }

  // Price change
  if ("price" in update && update.price !== existing.price) {
    priceChange = { field: "price", from: existing.price ?? null, to: update.price ?? null }
  }

  // Generic scalar fields
  for (const field of SCALAR_FIELDS) {
    if (field in update && update[field] !== existing[field]) {
      fieldChanges.push({ field, from: existing[field] ?? null, to: update[field] ?? null })
    }
  }

  return { musicianChange, bandChange, statusChange, priceChange, fieldChanges }
}
