import type { Session } from "next-auth"
import type { User } from "@/shared/types"

type SessionUser = NonNullable<Session["user"]>

export function sessionToUser(sessionUser: SessionUser): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email!,
    name: sessionUser.name!,
    role: sessionUser.role as User["role"],
    avatar: sessionUser.image ?? undefined,
    phone: sessionUser.phone,
    shows: sessionUser.shows ?? [],
    hourlyRate: sessionUser.hourlyRate,
    location: sessionUser.location,
    contactPerson: sessionUser.contactPerson,
    isActive: sessionUser.isActive ?? true,
    createdAt: sessionUser.createdAt ?? new Date().toISOString(),
  }
}
