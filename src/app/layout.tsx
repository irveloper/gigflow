import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { headers } from "next/headers"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { Providers } from "./providers"
const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GigFlow - Gestión de Músicos y Eventos",
  description: "Plataforma SaaS para la gestión de músicos y eventos",
  generator: "v0.app",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // nonce is forwarded by middleware via x-nonce header.
  // Pass it to any <Script nonce={nonce}> tags added in this layout.
  const hdrs = await headers()
  const nonce = hdrs.get("x-nonce") ?? undefined
  void nonce // available for future <Script nonce={nonce}> usage

  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
