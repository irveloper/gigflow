import { redirect } from "next/navigation"
import { auth } from "@/auth"
import type { ReactNode } from "react"
import { Navigation } from "@/widgets/navigation"

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  const isSuperAdmin = session.user.role === "superadmin"

  if (!isSuperAdmin) {
    const orgSlug = session.user.organizationSlug
    if (!orgSlug) {
      redirect("/auth/pending")
    }
    if (orgSlug !== slug) {
      redirect(`/org/${orgSlug}`)
    }
  }

  return (
    <>
      <Navigation />
      {children}
    </>
  )
}
