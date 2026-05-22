"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Music, Building2, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { generateSlug } from "@/lib/utils"
import { ActivationStepper } from "@/components/activation-stepper"
import { createOrgAction, checkSlugAction } from "./actions"

export default function NewOrgPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [error, setError] = useState<string | null>(null)

  // Auto-generate slug from name unless user has manually edited it
  useEffect(() => {
    if (!slugEdited && name) {
      setSlug(generateSlug(name))
    }
  }, [name, slugEdited])

  // Debounced slug availability check
  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle")
      return
    }
    setSlugStatus("checking")
    const timer = setTimeout(async () => {
      try {
        const result = await checkSlugAction(slug)
        setSlugStatus(result.available ? "available" : "taken")
      } catch {
        setSlugStatus("idle")
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  const handleSlugChange = (value: string) => {
    // Enforce slug format on input
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-/, "")
    setSlug(normalized)
    setSlugEdited(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug || slugStatus !== "available") return
    setError(null)

    startTransition(async () => {
      try {
        const result = await createOrgAction(name.trim(), slug)
        router.push(`/org/${result.slug}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear la organización")
      }
    })
  }

  const canSubmit = name.trim().length > 0 && slug.length > 0 && slugStatus === "available" && !isPending

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Gigflow</h1>
        </div>

        <ActivationStepper currentStep={2} variant="manager" />

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Crea tu organización</CardTitle>
            <CardDescription>
              Tu organización agrupa los hoteles, músicos y eventos que administras.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="org-name">Nombre de la organización</Label>
                <Input
                  id="org-name"
                  placeholder="Ej. Sonidos del Mar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="org-slug">URL de la organización</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="org-slug"
                      placeholder="sonidos-del-mar"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      disabled={isPending}
                      className="pr-8"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {slugStatus === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                      {slugStatus === "available" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {slugStatus === "taken" && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tu dashboard estará en{" "}
                  <span className="font-mono">/org/{slug || "tu-org"}</span>
                </p>
                {slugStatus === "taken" && (
                  <p className="text-xs text-red-500">Este slug ya está en uso</p>
                )}
                {slugStatus === "available" && (
                  <p className="text-xs text-green-600">Disponible</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear organización"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
