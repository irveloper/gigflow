import { z } from "zod"
import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure } from "@/server/trpc"
import { RegisterInputSchema } from "@/entities/user/schema"
import { sendEmail } from "@/lib/email"
import { verifyEmail as verifyEmailTemplate, resetPassword as resetPasswordTemplate, inviteConfirmed as inviteConfirmedTemplate } from "@/lib/email-templates"
import { env } from "@/lib/env"
import type { User } from "@/shared/types"

async function createVerificationToken(prisma: typeof import("@/lib/prisma").prisma, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: email, token } },
    update: { expires },
    create: { identifier: email, token, expires },
  })

  return token
}

export const authRouter = router({
  register: publicProcedure
    .input(RegisterInputSchema)
    .mutation(async ({ ctx, input }) => {

      const exists = await ctx.prisma.user.findUnique({ where: { email: input.email } })
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Email ya registrado" })

      const hashed = await bcrypt.hash(input.password, 12)

      const dbUser = await ctx.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: hashed,
          role: input.role,
          phone: input.phone ?? null,
          instruments: input.instruments ?? [],
          styles: input.styles ?? [],
          pricePerSet: input.pricePerSet ?? null,
          location: input.location ?? null,
          contactPerson: input.contactPerson ?? null,
        },
      })

      // Send verification email (non-blocking — don't fail registration if email fails)
      try {
        const token = await createVerificationToken(ctx.prisma, dbUser.email)
        const link = `${env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(dbUser.email)}`
        const { subject, html } = verifyEmailTemplate(dbUser.name, link)
        await sendEmail(dbUser.email, subject, html)
      } catch (err) {
        console.error("[auth.register] Failed to send verification email", err)
      }

      const user: User = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role as User["role"],
        phone: dbUser.phone ?? undefined,
        instruments: dbUser.instruments,
        styles: dbUser.styles,
        pricePerSet: dbUser.pricePerSet ?? undefined,
        location: dbUser.location ?? undefined,
        contactPerson: dbUser.contactPerson ?? undefined,
        isActive: dbUser.isActive,
        createdAt: dbUser.createdAt.toISOString(),
      }

      return user
    }),

  /** Resend verification email for the currently authenticated (unverified) user. */
  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const dbUser = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, emailVerified: true },
    })
    if (!dbUser) throw new TRPCError({ code: "NOT_FOUND" })
    if (dbUser.emailVerified) return { sent: false, reason: "already_verified" }

    const token = await createVerificationToken(ctx.prisma, dbUser.email)
    const link = `${env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(dbUser.email)}`
    const { subject, html } = verifyEmailTemplate(dbUser.name, link)
    await sendEmail(dbUser.email, subject, html)

    return { sent: true }
  }),

  /**
   * Request a password reset link. Always returns success to prevent email enumeration.
   * Token expires in 1 hour and is single-use.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const dbUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, name: true, email: true, password: true },
      })

      // Always return success — don't reveal whether email exists
      if (!dbUser?.password) return { sent: true }

      // Invalidate any existing tokens for this user
      await ctx.prisma.passwordResetToken.deleteMany({ where: { userId: dbUser.id } })

      const token = crypto.randomBytes(32).toString("hex")
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await ctx.prisma.passwordResetToken.create({
        data: { userId: dbUser.id, token, expires },
      })

      const link = `${env.NEXTAUTH_URL}/auth/reset-password?token=${token}`
      const { subject, html } = resetPasswordTemplate(dbUser.name, link)

      try {
        await sendEmail(dbUser.email, subject, html)
      } catch (err) {
        console.error("[auth.requestPasswordReset] Failed to send email", err)
      }

      return { sent: true }
    }),

  /**
   * Returns basic info for a pending invite token so the accept-invite page
   * can display the musician's name and email before the form is submitted.
   * Safe to expose publicly — no sensitive data returned.
   */
  getInviteInfo: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.prisma.musicianInvite.findUnique({
        where: { token: input.token },
        include: { musician: { select: { name: true } } },
      })

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "INVALID_TOKEN" })
      if (invite.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_USED" })
      if (invite.expires < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "TOKEN_EXPIRED" })

      return { name: invite.musician.name, email: invite.email }
    }),

  /**
   * Accept a musician portal invite.
   * Validates the token, creates a User account linked to the Musician entity,
   * and marks the invite as used. Token is single-use and time-limited.
   */
  acceptInvite: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.prisma.musicianInvite.findUnique({
        where: { token: input.token },
        include: {
          musician: true,
        },
      })

      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "INVALID_TOKEN" })
      if (invite.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_USED" })
      if (invite.expires < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "TOKEN_EXPIRED" })

      // Prevent duplicate accounts
      const existing = await ctx.prisma.user.findUnique({ where: { email: invite.email } })
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con este email." })

      const hashed = await bcrypt.hash(input.password, 12)

      const newUser = await ctx.prisma.user.create({
        data: {
          email: invite.email,
          name: invite.musician.name,
          password: hashed,
          role: "musician",
          musicianId: invite.musicianId,
          organizationId: invite.organizationId,
          phone: invite.musician.phone,
          instruments: invite.musician.instruments,
          styles: invite.musician.styles,
          pricePerSet: invite.musician.pricePerSet,
          isActive: true,
          emailVerified: new Date(),
        },
      })

      // Single-use: mark token consumed
      await ctx.prisma.musicianInvite.update({
        where: { token: input.token },
        data: { usedAt: new Date() },
      })

      // Confirmation email (non-blocking)
      try {
        const loginLink = `${env.NEXTAUTH_URL}/auth/login`
        const { subject, html } = inviteConfirmedTemplate(newUser.name, loginLink)
        await sendEmail(newUser.email, subject, html)
      } catch (err) {
        console.error("[auth.acceptInvite] Failed to send confirmation email", err)
      }

      return { success: true }
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const dbUser = await ctx.prisma.user.findUnique({
      where: { email: ctx.session.user.email! },
      include: {
        organization: { select: { slug: true } },
      },
    })
    if (!dbUser) throw new TRPCError({ code: "NOT_FOUND" })
    if (!dbUser.role) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "role_pending" })

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as User["role"],
      avatar: dbUser.image ?? undefined,
      phone: dbUser.phone ?? undefined,
      instruments: dbUser.instruments,
      styles: dbUser.styles,
      pricePerSet: dbUser.pricePerSet ?? undefined,
      location: dbUser.location ?? undefined,
      contactPerson: dbUser.contactPerson ?? undefined,
      isActive: dbUser.isActive,
      organizationId: dbUser.organizationId ?? undefined,
      organizationSlug: dbUser.organization?.slug ?? undefined,
      createdAt: dbUser.createdAt.toISOString(),
    }

    return user
  }),
})
