"use server"

import { auth, unstable_update } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function createOrgAction(name: string, slug: string): Promise<{ slug: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const existing = await prisma.organization.findUnique({ where: { slug } })
  if (existing) {
    throw new Error("Este slug ya está en uso. Elige otro.")
  }

  const org = await prisma.organization.create({
    data: { name, slug, status: "active" },
  })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { organizationId: org.id, role: "manager" },
  })

  // Refresh JWT so the new org context is available immediately
  await unstable_update({
    user: {
      organizationId: org.id,
      organizationSlug: org.slug,
      role: "manager",
    },
  })

  return { slug: org.slug }
}

export async function checkSlugAction(slug: string): Promise<{ available: boolean }> {
  const existing = await prisma.organization.findUnique({ where: { slug } })
  return { available: !existing }
}
