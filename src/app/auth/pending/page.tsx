"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Music, Building2, Mail, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActivationStepper } from "@/components/activation-stepper"
import { authModel } from "@/features/auth/model"
import { trpc } from "@/shared/lib/trpc"
import Link from "next/link"

export default function PendingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isExpired = searchParams.get("error") === "expired"

  // Use the URL param as an initial render hint to avoid flicker while the session loads.
  // Once useSession() resolves, the session state becomes the source of truth.
  const verifyHint = searchParams.get("verify") === "1"

  const { data: session, status } = useSession()

  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const handleLogout = async () => {
    await authModel.logoutFx()
    router.replace("/auth/login")
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendError(null)
    try {
      await trpc.auth.resendVerification.mutate()
      setResendSent(true)
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend. Try again.")
    } finally {
      setResendLoading(false)
    }
  }

  // Loading state — session not yet resolved.
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Session resolved — redirect to dashboard if user already has an org.
  if (session?.user.organizationSlug) {
    router.replace(`/org/${session.user.organizationSlug}`)
    return null
  }

  // Determine which step we're on based on session state (source of truth).
  // Fall back to URL hint on initial render before session resolves.
  const emailVerified = status === "authenticated"
    ? !!session?.user.emailVerified
    : !verifyHint

  const role = session?.user.role
  const isOrgOwner = role === "manager"

  // EMAIL VERIFIED — role-aware branching
  if (emailVerified) {
    // ORG OWNER: prompt to set up their org + plan
    if (isOrgOwner) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Music className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Gigflow</h1>
            </div>

            <ActivationStepper currentStep={2} variant="manager" />

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Set up your organization</CardTitle>
                <CardDescription>
                  Choose a plan and create your organization to unlock your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full">
                  <Link href="/onboarding/plan">
                    <Building2 className="mr-2 h-4 w-4" />
                    Choose a plan
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleLogout} className="w-full">
                  Sign out
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    // MUSICIAN / HOTEL: account is active, waiting to be added to an org
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Music className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Gigflow</h1>
          </div>

          <ActivationStepper currentStep={2} variant="member" />

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Account active</CardTitle>
              <CardDescription>
                Your email is verified. An organization admin will add you to their platform.
                You&apos;ll get access once you&apos;re connected to an organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={handleLogout} className="w-full">
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // INBOX mode: email not yet verified.
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Gigflow</h1>
        </div>

        <ActivationStepper currentStep={1} variant={isOrgOwner ? "manager" : "member"} />

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>
              {isExpired ? "Verification link expired" : "Check your inbox"}
            </CardTitle>
            <CardDescription>
              {isExpired
                ? "Your verification link has expired. Request a new one below."
                : "We sent a verification link to your email address. Click it to activate your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resendSent ? (
              <p className="text-sm text-center text-green-600 font-medium">
                Verification email sent! Check your inbox.
              </p>
            ) : (
              <Button
                className="w-full"
                onClick={handleResend}
                disabled={resendLoading}
              >
                {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend verification email
              </Button>
            )}
            {resendError && (
              <p className="text-sm text-destructive text-center">{resendError}</p>
            )}
            <Button variant="outline" onClick={handleLogout} className="w-full">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
