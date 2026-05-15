"use client"

import { useState } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { MapPin, Plus, Edit, Phone, Mail, Building, Users, AlertTriangle } from "lucide-react"
import { $user } from "@/entities/user/model"
import { sileo } from "sileo"

interface Hotel {
  id: string
  name: string
  location: string
  contactPerson: string
  email: string
  phone: string
  isActive: boolean
  totalEvents: number
  activeMusicians: number
  joinDate: string
  notes?: string
}

const INITIAL_HOTELS: Hotel[] = [
  { id: "1", name: "Hotel Paradisus Cancún", location: "Zona Hotelera, Cancún", contactPerson: "María González", email: "eventos@paradisus.com", phone: "+52 998 881 1100", isActive: true, totalEvents: 156, activeMusicians: 8, joinDate: "2024-01-10", notes: "Hotel premium con múltiples espacios para eventos musicales" },
  { id: "2", name: "Hotel Moon Palace", location: "Carretera Cancún-Chetumal", contactPerson: "Carlos Ruiz", email: "entertainment@moonpalace.com", phone: "+52 998 881 6000", isActive: true, totalEvents: 134, activeMusicians: 6, joinDate: "2024-01-15", notes: "Resort all-inclusive con gran demanda de entretenimiento" },
  { id: "3", name: "Hotel Xcaret", location: "Playa del Carmen", contactPerson: "Ana Martínez", email: "shows@xcaret.com", phone: "+52 984 206 3000", isActive: true, totalEvents: 89, activeMusicians: 5, joinDate: "2024-02-01", notes: "Hotel eco-integrado con enfoque cultural" },
  { id: "4", name: "Hotel Iberostar", location: "Zona Hotelera, Cancún", contactPerson: "Roberto Silva", email: "eventos@iberostar.com", phone: "+52 998 881 8000", isActive: false, totalEvents: 45, activeMusicians: 0, joinDate: "2024-03-15", notes: "Temporalmente suspendido por renovaciones" },
]

const EMPTY_FORM = { name: "", location: "", contactPerson: "", email: "", phone: "", isActive: true, notes: "" }

export function AdminHotelsManager() {
  const user = useUnit($user)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [hotels, setHotels] = useState<Hotel[]>(INITIAL_HOTELS)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const handleCreate = () => {
    const { name, location, contactPerson, email } = formData
    if (!name || !location || !contactPerson || !email) {
      sileo.error({ title: "Error", description: "Completa todos los campos obligatorios" })
      return
    }

    setHotels([...hotels, {
      id: Math.random().toString(36).slice(2, 9),
      ...formData,
      totalEvents: 0,
      activeMusicians: 0,
      joinDate: new Date().toISOString().split("T")[0],
    }])

    sileo.success({ title: "Hotel Agregado", description: `${name} agregado al sistema` })
    setFormData(EMPTY_FORM)
    setIsDialogOpen(false)
  }

  const toggleStatus = (id: string) => {
    const hotel = hotels.find((h) => h.id === id)
    setHotels(hotels.map((h) => h.id === id ? { ...h, isActive: !h.isActive } : h))
    sileo.success({ title: hotel?.isActive ? "Hotel Desactivado" : "Hotel Activado", description: `${hotel?.name} actualizado` })
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Hoteles</h1>
            <p className="text-gray-600">Administrar hoteles y sus contactos</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Agregar Hotel</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Hotel</DialogTitle>
                <DialogDescription>Completa la información del hotel</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Hotel Paradisus Cancún" />
                </div>
                <div>
                  <Label htmlFor="location">Ubicación *</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Zona Hotelera, Cancún" />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Contacto *</Label>
                  <Input id="contactPerson" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} placeholder="María González" />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="eventos@hotel.com" />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+52 998 881 1100" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="isActive" checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} />
                  <Label htmlFor="isActive">Hotel activo</Label>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Información adicional..." rows={3} />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreate} className="flex-1">Agregar Hotel</Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Building, color: "text-blue-500", label: "Total Hoteles", value: hotels.length },
            { icon: Building, color: "text-green-500", label: "Activos", value: hotels.filter((h) => h.isActive).length },
            { icon: Users, color: "text-purple-500", label: "Eventos Totales", value: hotels.reduce((a, h) => a + h.totalEvents, 0) },
            { icon: MapPin, color: "text-orange-500", label: "Músicos Activos", value: hotels.reduce((a, h) => a + h.activeMusicians, 0) },
          ].map(({ icon: Icon, color, label, value }) => (
            <Card key={label}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className={hotel.isActive ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{hotel.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />{hotel.location}
                    </CardDescription>
                  </div>
                  <Badge variant={hotel.isActive ? "default" : "secondary"}>
                    {hotel.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm"><Users className="h-3 w-3 text-gray-500" /><span className="font-medium">{hotel.contactPerson}</span></div>
                  <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="h-3 w-3" />{hotel.email}</div>
                  {hotel.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="h-3 w-3" />{hotel.phone}</div>}
                </div>
                {hotel.notes && <div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-700">{hotel.notes}</p></div>}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{hotel.totalEvents}</p>
                    <p className="text-xs text-gray-600">Total Eventos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{hotel.activeMusicians}</p>
                    <p className="text-xs text-gray-600">Músicos Activos</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent"><Edit className="h-3 w-3 mr-1" />Editar</Button>
                  <Button variant={hotel.isActive ? "outline" : "default"} size="sm" onClick={() => toggleStatus(hotel.id)}>
                    {hotel.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {hotels.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay hoteles registrados</h3>
              <p className="text-gray-600 mb-4">Comienza agregando hoteles al sistema</p>
              <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Agregar Primer Hotel</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
