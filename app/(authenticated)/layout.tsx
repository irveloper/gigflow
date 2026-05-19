"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useUnit } from "effector-react"
import { useRouter, usePathname } from "next/navigation"
import Loading from "./loading"
import { authModel } from "@/features/auth/model"
import { Navigation } from "@/widgets/navigation"

/**
 * Client-side auth guard for all authenticated routes.
 * proxy.ts handles the server-side check.
 * This covers the client-side window before auth hydration completes or after logout.
 */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthResolved, isPending } = useUnit({
    user: authModel.$user,
    isAuthResolved: authModel.$isAuthResolved,
    isPending: authModel.$isPending,
  })

  useEffect(() => {
    if (!isAuthResolved) return
    if (isPending) {
      router.replace("/auth/pending")
    } else if (user === null) {
      router.replace(`/auth/login?from=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthResolved, isPending, pathname, router, user])

  if (!isAuthResolved || user === null) {
    return <Loading />
  }

  return (
    <>
      <Navigation />
      {children}
    </>
  )
}
