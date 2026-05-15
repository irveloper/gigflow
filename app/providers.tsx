"use client"

import type React from "react"
import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sileo"
import { authModel } from "@/features/auth/model"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    authModel.checkAuth()
  }, [])

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        <Toaster position="bottom-right" />
      </ThemeProvider>
    </SessionProvider>
  )
}
