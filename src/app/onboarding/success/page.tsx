"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Music, CheckCircle, Loader2 } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 15 // 30 seconds total

export default function OnboardingSuccessPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { update } = useSession()
  const slug = params.get("slug")
  const [status, setStatus] = useState<"polling" | "ready" | "timeout">("polling")
  const attempts = useRef(0)
  const pollingStarted = useRef(false)

  useEffect(() => {
    if (!slug) {
      router.replace("/")
      return
    }

    if (pollingStarted.current) return
    pollingStarted.current = true

    const poll = async () => {
      attempts.current++
      try {
        // Fetch current user from database via tRPC (bypassing stale session cookie)
        const dbUser = await trpc.auth.me.query()

        if (dbUser.organizationId) {
          // Explicitly update session with organization context to sync the cookie
          await update({
            user: {
              organizationId: dbUser.organizationId,
              organizationSlug: dbUser.organizationSlug,
              role: dbUser.role,
            },
          })

          // Check if billing subscription is active (this will now succeed because cookie has organizationId)
          const sub = await trpc.billing.getSubscription.query()
          if (sub.status === "trialing" || sub.status === "active") {
            setStatus("ready")
            setTimeout(() => {
              router.replace(`/org/${slug}`)
            }, 1500)
            return
          }
        }
      } catch (err) {
        console.error("Onboarding success polling check:", err)
        // Keep polling
      }

      if (attempts.current >= MAX_ATTEMPTS) {
        setStatus("timeout")
        return
      }

      setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
  }, [slug, router, update])

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
