"use client"

import { useEffect } from "react"
import { eventsModel } from "@/features/events/model"
import { AdminEventsManager } from "@/widgets/admin-events"

export default function AdminEventsPage() {
  useEffect(() => {
    eventsModel.loadEvents()
  }, [])

  return <AdminEventsManager />
}
