import { z } from "zod"

// ---------------------------------------------------------------------------
// Cursor-based pagination (for event lists ordered by a sequential field)
// ---------------------------------------------------------------------------
export const CursorPaginationInputSchema = z.object({
  limit: z.number().min(1).max(200).default(50),
  /** Opaque cursor returned from a previous response */
  cursor: z.string().optional(),
})

export type CursorPaginationInput = z.infer<typeof CursorPaginationInputSchema>

export function CursorPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    total: z.number(),
  })
}

// ---------------------------------------------------------------------------
// Offset-based pagination (for admin list views)
// ---------------------------------------------------------------------------
export const OffsetPaginationInputSchema = z.object({
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
})

export type OffsetPaginationInput = z.infer<typeof OffsetPaginationInputSchema>

export function OffsetPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
  })
}
