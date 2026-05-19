"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUnit } from "effector-react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ArrowLeft, Loader2, Building, Phone, User } from "lucide-react"
import { $user } from "@/entities/user/model"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"
import type { Hotel } from "@/shared/types"

export default function HotelDetailPage() {
  const { slug, hotelId } = useParams<{ slug: string; hotelId: string }>()
  const router = useRouter()
  const user = useUnit($user)

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [orgContact, setOrgContact] = useState<{ contactPerson: string | null; contactPhone: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  const [globalForm, setGlobalForm] = useState({ name: "", location: "", email: "", phone: "", contactPerson: "", isActive: true })
  const [orgContactForm, setOrgContactForm] = useState({ contactPerson: "", contactPhone: "" })
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [h, oc] = await Promise.all([
          trpc.hotels.getById.query({ id: hotelId }),
          trpc.hotels.getOrgContact.query({ hotelId }),
        ])
        setHotel(h)
        setOrgContact(oc)
        setGlobalForm({
          name: h.name,
          location: h.location,
          email: h.email,
          phone: h.phone,
          contactPerson: h.contactPerson,
          isActive: h.isActive,
        })
        setOrgContactForm({
          contactPerson: oc?.contactPerson ?? "",
          contactPhone: oc?.contactPhone ?? "",
        })
      } catch {
        sileo.error({ title: "Error", description: "No se pudo cargar la información del hotel." })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [hotelId])

  const handleSaveGlobal = async () => {
    if (!hotel) return
    setSavingGlobal(true)
    try {
      const updated = await trpc.hotels.update.mutate({
        id: hotel.id,
        name: globalForm.name,
        location: globalForm.location,
        email: globalForm.email,
        phone: globalForm.phone,
        contactPerson: globalForm.contactPerson,
        isActive: globalForm.isActive,
        createdAt: hotel.createdAt,
      })
      setHotel(updated)
      sileo.success({ title: "Hotel actualizado", description: "Los cambios globales fueron guardados." })
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al actualizar hotel." })
    } finally {
      setSavingGlobal(false)
    }
  }

  const handleSaveOrgContact = async () => {
    setSavingContact(true)
    try {
      await trpc.hotels.updateOrgHotelContact.mutate({
        hotelId,
        contactPerson: orgContactForm.contactPerson || undefined,
        contactPhone: orgContactForm.contactPhone || undefined,
      })
      sileo.success({ title: "Contacto actualizado", description: "El contacto de tu organización fue guardado." })
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al actualizar contacto." })
    } finally {
      setSavingContact(false)
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

  if (!hotel) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Hotel no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/org/${slug}/admin/hotels`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{hotel.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={hotel.isActive ? "default" : "secondary"}>
              {hotel.isActive ? "Activo" : "Inactivo"}
            </Badge>
            <span className="text-sm text-muted-foreground">{hotel.location}</span>
          </div>
        </div>
      </div>

      {/* Global hotel fields — shared across all orgs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Datos generales
          </CardTitle>
          <CardDescription>
            Esta información es compartida entre todas las organizaciones que usan este hotel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="g-name">Nombre</Label>
              <Input id="g-name" value={globalForm.name} onChange={(e) => setGlobalForm({ ...globalForm, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="g-loc">Ubicación</Label>
              <Input id="g-loc" value={globalForm.location} onChange={(e) => setGlobalForm({ ...globalForm, location: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={globalForm.email} onChange={(e) => setGlobalForm({ ...globalForm, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="g-phone">Teléfono</Label>
              <Input id="g-phone" value={globalForm.phone} onChange={(e) => setGlobalForm({ ...globalForm, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="g-contact">Contacto global</Label>
              <Input id="g-contact" value={globalForm.contactPerson} onChange={(e) => setGlobalForm({ ...globalForm, contactPerson: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="g-active" checked={globalForm.isActive} onCheckedChange={(v) => setGlobalForm({ ...globalForm, isActive: v })} />
              <Label htmlFor="g-active">Hotel activo</Label>
            </div>
          </div>
          <Button onClick={handleSaveGlobal} disabled={savingGlobal}>
            {savingGlobal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar datos generales
          </Button>
        </CardContent>
      </Card>

      {/* Org-specific contact — stored on the HotelOrganization join */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Contacto de tu organización
          </CardTitle>
          <CardDescription>
            Persona de contacto exclusiva para tu organización. Sobrescribe el contacto global solo para tus reservas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="oc-person">Nombre del contacto</Label>
              <Input
                id="oc-person"
                value={orgContactForm.contactPerson}
                onChange={(e) => setOrgContactForm({ ...orgContactForm, contactPerson: e.target.value })}
                placeholder={hotel.contactPerson}
              />
            </div>
            <div>
              <Label htmlFor="oc-phone">
                <Phone className="inline h-3 w-3 mr-1" />
                Teléfono del contacto
              </Label>
              <Input
                id="oc-phone"
                value={orgContactForm.contactPhone}
                onChange={(e) => setOrgContactForm({ ...orgContactForm, contactPhone: e.target.value })}
                placeholder="+52 998 123 4567"
              />
            </div>
          </div>
          <Button onClick={handleSaveOrgContact} disabled={savingContact} variant="outline">
            {savingContact && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar contacto de organización
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
