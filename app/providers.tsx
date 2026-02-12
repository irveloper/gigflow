"use client"

import type React from "react"

import { useEffect } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { authModel } from "@/features/auth/model"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Check authentication on app start
    authModel.checkAuth()
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
