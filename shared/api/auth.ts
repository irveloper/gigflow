import { signIn, signOut, getSession as nextAuthGetSession } from "next-auth/react"
import type { User, LoginInput, RegisterInput } from "@/shared/types"
import { trpc } from "@/shared/lib/trpc"
import { sessionToUser } from "@/shared/lib/session"

// Phase 2: NextAuth credentials + Prisma
// login/logout/getSession use next-auth/react
// register goes through tRPC (creates DB row) then signIn

export async function login({ email, password }: LoginInput): Promise<User> {
  const result = await signIn("credentials", { email, password, redirect: false })
  if (result?.error) throw new Error("Credenciales invalidas")
  return getSessionUser()
}

export async function logout(): Promise<void> {
  await signOut({ redirect: false })
}

async function getSessionUser(): Promise<User> {
  const session = await nextAuthGetSession()
  if (!session?.user) throw new Error("No se pudo obtener la sesión")
  if (!session.user.role) throw new Error("ROLE_PENDING")
  return sessionToUser(session.user)
}

/** Used by checkAuthFx — returns null for unauthenticated, throws ROLE_PENDING
 *  for authenticated users awaiting role assignment. */
export async function getSession(): Promise<User | null> {
  const session = await nextAuthGetSession()
  if (!session?.user) return null
  if (!session.user.role) throw new Error("ROLE_PENDING")
  return sessionToUser(session.user)
}

export async function register(input: RegisterInput): Promise<User> {
  await trpc.auth.register.mutate(input)

  const result = await signIn("credentials", {
    email: input.email,
    password: input.password,
    redirect: false,
  })
  if (result?.error) throw new Error("Registro exitoso pero no se pudo iniciar sesión")

  return getSessionUser()
}
