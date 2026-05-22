"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertTriangle, ArrowLeft, Loader2, Music } from "lucide-react"
import { $user } from "@/entities/user/model"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"
import type { Musician } from "@/shared/types"

export default function MusicianDetailPage() {
  const { slug, musicianId } = useParams<{ slug: string; musicianId: string }>()
  const router = useRouter()
  const user = useUnit($user)

  const [musician, setMusician] = useState<Musician | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: "", email: "", phone: "", instruments: "", pricePerSet: 0, isActive: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const m = await trpc.musicians.getById.query({ id: musicianId })
        setMusician(m)
        setForm({
          name: m.name,
          email: m.email,
          phone: m.phone,
          instruments: m.instruments.join(", "),
          pricePerSet: m.pricePerSet,
          isActive: m.isActive,
        })
      } catch {
        sileo.error({ title: "Error", description: "No se pudo cargar la información del músico." })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [musicianId])

  const handleSave = async () => {
    if (!musician) return
    setSaving(true)
    try {
      const updated = await trpc.musicians.update.mutate({
        id: musician.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        instruments: form.instruments.split(",").map((s) => s.trim()).filter(Boolean),
        styles: musician.styles,
        pricePerSet: Number(form.pricePerSet),
        isActive: form.isActive,
        createdAt: musician.createdAt,
      })
      setMusician(updated)
      sileo.success({ title: "Músico actualizado" })
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al actualizar músico." })
    } finally {
      setSaving(false)
    }
  }

  if (user && user.role !== "manager") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
            <p className="text-gray-600">Solo los gerentes pueden acceder a esta sección.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!musician) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Músico no encontrado.</p>
      </div>
    )
  }

  const initials = musician.name.split(" ").map((n) => n[0]).join("").toUpperCase()

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/org/${slug}/admin/musicians`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={musician.avatar ?? "/placeholder.svg"} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{musician.name}</h1>
          <Badge variant={musician.isActive ? "default" : "secondary"} className="mt-1">
            {musician.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Datos del músico
          </CardTitle>
          <CardDescription>
            Esta información es compartida entre todas las organizaciones que trabajan con este músico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="m-name">Nombre completo</Label>
              <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="m-email">Email</Label>
              <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="m-phone">Teléfono</Label>
              <Input id="m-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="m-rate">Tarifa por set ($)</Label>
              <Input id="m-rate" type="number" value={form.pricePerSet} onChange={(e) => setForm({ ...form, pricePerSet: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="m-active">Estado</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch id="m-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <span className="text-sm">{form.isActive ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="m-instruments">Instrumentos/Conceptos musicales</Label>
              <Input
                id="m-instruments"
                value={form.instruments}
                onChange={(e) => setForm({ ...form, instruments: e.target.value })}
                placeholder="Acoustic Set, Jazz Trio, Solo Piano"
              />
              <p className="text-xs text-muted-foreground mt-1">Separa con comas</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
