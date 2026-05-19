"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { eventsModel } from "@/features/events/model"
import { CheckInForm } from "@/widgets/check-in-form"

export default function CheckInPage() {
  const params = useParams()
  const eventId = params.eventId as string

  useEffect(() => {
    eventsModel.loadEvents()
  }, [])

  return <CheckInForm eventId={eventId} />
}
