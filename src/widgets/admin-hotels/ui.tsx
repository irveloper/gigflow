"use client"

import { useState, useEffect, useCallback } from "react"
import { useUnit } from "effector-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  MapPin, Plus, Phone, Mail, Building, AlertTriangle,
  Link2, Link2Off, Search, Loader2, ExternalLink, Trash2,
} from "lucide-react"
import { $user } from "@/entities/user/model"
import { $organization } from "@/entities/organization/model"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"
import type { Hotel } from "@/shared/types"
import { LocationSelect, type LocationValue } from "@/shared/ui/location-select"

const EMPTY_LOCATION: LocationValue = {
  countryCode: "", country: "", stateCode: "", state: "", city: "",
}

const EMPTY_FORM = {
  name: "", address: "", postalCode: "", contactPerson: "", email: "", phone: "", isActive: true, avatar: "",
  ...EMPTY_LOCATION,
}

function HotelCard({
  hotel,
  linked,
  slug,
  onLink,
  onUnlink,
  onDelete,
  linking,
}: {
  hotel: Hotel
  linked: boolean
  slug: string
  onLink: (id: string) => void
  onUnlink: (id: string) => void
  onDelete: (id: string) => void
  linking: boolean
}) {
  return (
    <Card className={hotel.isActive ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{hotel.name}</p>
              <Badge variant={hotel.isActive ? "default" : "secondary"} className="shrink-0">
                {hotel.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {hotel.city}{hotel.state ? `, ${hotel.state}` : ""}, {hotel.country}
            </p>
          </div>
          {linked && (
            <div className="flex items-center gap-1">
              <Link href={`/org/${slug}/admin/hotels/${hotel.id}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(hotel.id)}
                disabled={linking}
                title="Eliminar hotel"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3 w-3" />{hotel.email}
          </div>
          {hotel.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3 w-3" />{hotel.phone}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Building className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{hotel.contactPerson}</span>
          </div>
        </div>
        <div className="pt-2 border-t">
          {linked ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onUnlink(hotel.id)}
              disabled={linking}
            >
              <Link2Off className="h-3 w-3 mr-1" />
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onLink(hotel.id)}
              disabled={linking}
            >
              {linking ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminHotelsManager() {
  const [user, organization] = useUnit([$user, $organization])
  const slug = organization?.slug ?? ""

  const [linkedHotels, setLinkedHotels] = useState<Hotel[]>([])
  const [linkedTotal, setLinkedTotal] = useState(0)
  const [linkedOffset, setLinkedOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const PAGE_SIZE = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Hotel[]>([])
  const [searching, setSearching] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const linkedIds = new Set(linkedHotels.map((h) => h.id))

  const fetchLinked = useCallback(async (offset = 0) => {
    try {
      const data = await trpc.hotels.getAll.query({ limit: PAGE_SIZE, offset })
      if (offset === 0) {
        setLinkedHotels(data.items)
      } else {
        setLinkedHotels((prev) => [...prev, ...data.items])
      }
      setLinkedTotal(data.total)
      setLinkedOffset(offset)
    } catch {
      sileo.error({ title: "Error", description: "No se pudo cargar la lista de hoteles." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinked(0) }, [fetchLinked])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await trpc.hotels.search.query({ query: searchQuery })
        setSearchResults(data)
      } catch {
        sileo.error({ title: "Error", description: "Error al buscar hoteles." })
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleLink = async (hotelId: string) => {
    setLinkingId(hotelId)
    try {
      await trpc.hotels.linkHotel.mutate({ hotelId })
      sileo.success({ title: "Hotel conectado", description: "El hotel fue agregado a tu organización." })
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al conectar hotel." })
    } finally {
      setLinkingId(null)
    }
  }

  const handleUnlink = async (hotelId: string) => {
    if (!confirm("¿Desconectar este hotel de tu organización?")) return
    setLinkingId(hotelId)
    try {
      await trpc.hotels.unlinkHotel.mutate({ hotelId })
      sileo.success({ title: "Hotel desconectado" })
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al desconectar hotel." })
    } finally {
      setLinkingId(null)
    }
  }

  const handleDelete = async (hotelId: string) => {
    if (!confirm("¿Eliminar este hotel de tu organización? Si ninguna otra organización lo usa, se borrará permanentemente.")) return
    setLinkingId(hotelId)
    try {
      await trpc.hotels.delete.mutate({ id: hotelId })
      sileo.success({ title: "Hotel eliminado" })
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al eliminar hotel." })
    } finally {
      setLinkingId(null)
    }
  }

  const handleCreate = async () => {
    const { name, address, city, state, stateCode, countryCode, country, postalCode, contactPerson, email, phone, isActive } = form
    if (!name || !address || !city || !countryCode || !postalCode || !contactPerson || !email) {
      sileo.error({ title: "Error", description: "Completa todos los campos obligatorios." })
      return
    }
    setCreating(true)
    try {
      await trpc.hotels.create.mutate({
        name, address, city, state, stateCode, countryCode, country, postalCode,
        contactPerson, email, phone, isActive, avatar: form.avatar || undefined,
      })
      sileo.success({ title: "Hotel creado", description: `${name} fue creado y conectado a tu organización.` })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al crear hotel." })
    } finally {
      setCreating(false)
    }
  }

  if (user?.role !== "manager") {
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Hoteles</h1>
          <p className="text-muted-foreground mt-1">Conecta hoteles a tu organización y gestiona contactos</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Hotel</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear y conectar hotel</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="c-name">Nombre *</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <LocationSelect
                  value={{ countryCode: form.countryCode, country: form.country, stateCode: form.stateCode, state: form.state, city: form.city }}
                  onChange={(loc: LocationValue) => setForm({ ...form, ...loc })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="c-address">Dirección *</Label>
                <Input id="c-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Blvd. Kukulcan Km 16.5" />
              </div>
              <div>
                <Label htmlFor="c-postal">Código postal *</Label>
                <Input id="c-postal" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="c-contact">Contacto *</Label>
                <Input id="c-contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="c-email">Email *</Label>
                <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="c-phone">Teléfono</Label>
                <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="c-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label htmlFor="c-active">Hotel activo</Label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={creating} className="flex-1">
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear y conectar
              </Button>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="linked">
        <TabsList>
          <TabsTrigger value="linked">
            Mis Hoteles {!loading && <Badge variant="secondary" className="ml-1">{linkedHotels.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="search">Buscar Hotel</TabsTrigger>
        </TabsList>

        <TabsContent value="linked" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando...
            </div>
          ) : linkedHotels.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-40 text-muted-foreground" />
                <p className="font-medium mb-1">No tienes hoteles conectados</p>
                <p className="text-sm text-muted-foreground mb-4">Usa la pestaña "Buscar Hotel" para conectar hoteles existentes o crea uno nuevo.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {linkedHotels.map((hotel) => (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    linked
                    slug={slug}
                    onLink={handleLink}
                    onUnlink={handleUnlink}
                    onDelete={handleDelete}
                    linking={linkingId === hotel.id}
                  />
                ))}
              </div>
              {linkedHotels.length < linkedTotal && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => fetchLinked(linkedOffset + PAGE_SIZE)}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Cargar más ({linkedHotels.length}/{linkedTotal})
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="search" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar hoteles en la plataforma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  linked={linkedIds.has(hotel.id)}
                  slug={slug}
                  onLink={handleLink}
                  onUnlink={handleUnlink}
                  onDelete={handleDelete}
                  linking={linkingId === hotel.id}
                />
              ))}
            </div>
          )}

          {searchQuery && !searching && searchResults.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No se encontraron hoteles para "{searchQuery}"</p>
          )}

          {!searchQuery && (
            <p className="text-center text-muted-foreground py-8">Escribe el nombre de un hotel para buscarlo</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
