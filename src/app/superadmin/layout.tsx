import { redirect } from "next/navigation"
import { auth } from "@/auth"
import type { ReactNode } from "react"
import { Navigation } from "@/widgets/navigation"

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  if (session.user.role !== "superadmin") {
    redirect("/")
  }

  return (
    <>
      <Navigation />
      {children}
    </>
  )
}
