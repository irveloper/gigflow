"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Music, CheckCircle, Loader2 } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 15 // 30 seconds total

export default function OnboardingSuccessPage() {
  const router = useRouter()
  const params = useSearchParams()
  const slug = params.get("slug")
  const [status, setStatus] = useState<"polling" | "ready" | "timeout">("polling")
  const attempts = useRef(0)

  useEffect(() => {
    if (!slug) {
      router.replace("/")
      return
    }

    const poll = async () => {
      attempts.current++
      try {
        const sub = await trpc.billing.getSubscription.query()
        if (sub.status === "trialing" || sub.status === "active") {
          setStatus("ready")
          setTimeout(() => {
            router.replace(`/org/${slug}`)
          }, 1500)
          return
        }
      } catch {
        // subscription not yet created — keep polling
      }

      if (attempts.current >= MAX_ATTEMPTS) {
        setStatus("timeout")
        return
      }

      setTimeout(poll, POLL_INTERVAL_MS)
    }

    setTimeout(poll, POLL_INTERVAL_MS)
  }, [slug, router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <Music className="h-10 w-10 text-primary" />
        </div>

        {status === "polling" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold">Setting up your organization…</h1>
            <p className="text-muted-foreground mt-2">This takes just a moment.</p>
          </>
        )}

        {status === "ready" && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">You&apos;re all set!</h1>
            <p className="text-muted-foreground mt-2">Taking you to your dashboard…</p>
          </>
        )}

        {status === "timeout" && (
          <>
            <h1 className="text-2xl font-bold">Almost there…</h1>
            <p className="text-muted-foreground mt-2">
              Your payment was received. If your dashboard doesn&apos;t load automatically,{" "}
              <a href={`/org/${slug}`} className="text-primary underline">
                click here
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  )
}
