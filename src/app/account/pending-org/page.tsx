"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Music, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ActivationStepper } from "@/components/activation-stepper"

export default function PendingOrgPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  // If the user has been added to an org since this page loaded, send them to their dashboard.
  useEffect(() => {
    if (session?.user.organizationSlug) {
      router.replace(`/org/${session.user.organizationSlug}`)
    }
  }, [session?.user.organizationSlug, router])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/login" })
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

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
              Your email is verified and your account is ready. An organization admin will add you
              to their platform — you&apos;ll get full access once you&apos;re connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Signed in as <span className="font-medium">{session?.user.email}</span>
            </p>
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
