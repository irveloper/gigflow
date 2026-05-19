"use client"

import { useState, useEffect, useCallback } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Music2, Users, AlertTriangle, Loader2, UserMinus, UserPlus, Pencil } from "lucide-react"
import { $user } from "@/entities/user/model"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"
import type { Band, Musician } from "@/shared/types"

const EMPTY_FORM = {
  name: "", description: "", genre: "", memberIds: [] as string[],
}

function BandCard({
  band,
  musicians,
  onDeactivate,
  onEdit,
  onAddMember,
  onRemoveMember,
}: {
  band: Band
  musicians: Musician[]
  onDeactivate: (id: string) => void
  onEdit: (band: Band) => void
  onAddMember: (bandId: string, musicianId: string) => void
  onRemoveMember: (bandId: string, musicianId: string) => void
}) {
  const memberMusicians = musicians.filter((m) => band.members?.includes(m.id))
  const nonMembers = musicians.filter((m) => !band.members?.includes(m.id))

  return (
    <Card className={band.isActive ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold">{band.name}</p>
              <Badge variant={band.isActive ? "default" : "secondary"}>
                {band.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            {band.genre && (
              <Badge variant="outline" className="text-xs mt-1">{band.genre}</Badge>
            )}
            {band.description && (
              <p className="text-sm text-muted-foreground mt-1">{band.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(band)}
              title="Editar banda"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {band.isActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  Desactivar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Desactivar banda?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La banda no aparecerá en el selector de eventos pero se conservará en el historial.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => onDeactivate(band.id)}
                  >
                    Desactivar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" /> MIEMBROS ({memberMusicians.length})
          </p>
          <div className="space-y-1">
            {memberMusicians.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.name}</span>
                {band.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-500 hover:text-red-600"
                    onClick={() => onRemoveMember(band.id, m.id)}
                    disabled={(band.members?.length ?? 0) <= 2}
                    title={(band.members?.length ?? 0) <= 2 ? "Mínimo 2 miembros" : "Eliminar miembro"}
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        {band.isActive && nonMembers.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Agregar miembro</p>
            <div className="flex flex-wrap gap-1">
              {nonMembers.map((m) => (
                <Button
                  key={m.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddMember(band.id, m.id)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {m.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminBandsManager() {
  const [user] = useUnit([$user])
  const [bands, setBands] = useState<Band[]>([])
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editOpen, setEditOpen] = useState(false)
  const [editBand, setEditBand] = useState<Band | null>(null)
  const [editForm, setEditForm] = useState({ name: "", genre: "", description: "" })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [bandsData, musiciansData] = await Promise.all([
        trpc.bands.getAll.query(),
        trpc.musicians.getAll.query({ limit: 100, offset: 0 }),
      ])
      setBands(bandsData)
      setMusicians(musiciansData.items)
    } catch {
      sileo.error({ title: "Error", description: "No se pudieron cargar los datos." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    if (!form.name) {
      sileo.error({ title: "Error", description: "El nombre de la banda es requerido." })
      return
    }
    if (form.memberIds.length < 2) {
      sileo.error({ title: "Error", description: "Una banda debe tener al menos 2 miembros." })
      return
    }
    setCreating(true)
    try {
      await trpc.bands.create.mutate({
        name: form.name,
        description: form.description || undefined,
        genre: form.genre || undefined,
        isActive: true,
        memberIds: form.memberIds,
      })
      sileo.success({ title: "Banda creada", description: `${form.name} fue creada exitosamente.` })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      await fetchData()
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al crear la banda." })
    } finally {
      setCreating(false)
    }
  }

  const handleOpenEdit = (band: Band) => {
    setEditBand(band)
    setEditForm({ name: band.name, genre: band.genre ?? "", description: band.description ?? "" })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editBand) return
    if (!editForm.name.trim()) {
      sileo.error({ title: "Error", description: "El nombre es requerido." })
      return
    }
    setSaving(true)
    try {
      await trpc.bands.update.mutate({
        id: editBand.id,
        name: editForm.name,
        genre: editForm.genre || undefined,
        description: editForm.description || undefined,
      })
      sileo.success({ title: "Banda actualizada" })
      setEditOpen(false)
      await fetchData()
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al actualizar." })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await trpc.bands.deactivate.mutate({ id })
      sileo.success({ title: "Banda desactivada" })
      await fetchData()
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al desactivar." })
    }
  }

  const handleAddMember = async (bandId: string, musicianId: string) => {
    try {
      await trpc.bands.addMember.mutate({ bandId, musicianId })
      sileo.success({ title: "Miembro agregado" })
      await fetchData()
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al agregar miembro." })
    }
  }

  const handleRemoveMember = async (bandId: string, musicianId: string) => {
    try {
      await trpc.bands.removeMember.mutate({ bandId, musicianId })
      sileo.success({ title: "Miembro eliminado" })
      await fetchData()
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al eliminar miembro." })
    }
  }

  const toggleMember = (musicianId: string) => {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(musicianId)
        ? prev.memberIds.filter((id) => id !== musicianId)
        : [...prev.memberIds, musicianId],
    }))
  }

  if (!user || user.role !== "manager") {
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
          <h1 className="text-2xl font-bold">Gestión de Bandas</h1>
          <p className="text-muted-foreground mt-1">Crea grupos musicales con varios miembros para asignarlos a eventos</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Banda</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear banda</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="b-name">Nombre *</Label>
                <Input id="b-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jazz Trio Cancún" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="b-genre">Género musical</Label>
                  <Input id="b-genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Jazz, Flamenco..." />
                </div>
                <div>
                  <Label htmlFor="b-desc">Descripción</Label>
                  <Input id="b-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descripción..." />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">
                  Miembros * <span className="text-muted-foreground font-normal">(mínimo 2)</span>
                </Label>
                {musicians.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay músicos disponibles. Agrega músicos primero.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {musicians.map((m) => {
                      const selected = form.memberIds.includes(m.id)
                      return (
                        <Button
                          key={m.id}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleMember(m.id)}
                        >
                          {selected && <span className="mr-1">✓</span>}
                          {m.name}
                        </Button>
                      )
                    })}
                  </div>
                )}
                {form.memberIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.memberIds.length} seleccionado{form.memberIds.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={creating} className="flex-1">
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear banda
              </Button>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit band dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar banda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="e-name">Nombre *</Label>
              <Input id="e-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="e-genre">Género musical</Label>
              <Input id="e-genre" value={editForm.genre} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })} placeholder="Jazz, Flamenco..." />
            </div>
            <div>
              <Label htmlFor="e-desc">Descripción</Label>
              <Input id="e-desc" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleEdit} disabled={saving} className="flex-1">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando...
        </div>
      ) : bands.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Music2 className="h-12 w-12 mx-auto mb-4 opacity-40 text-muted-foreground" />
            <p className="font-medium mb-1">No hay bandas registradas</p>
            <p className="text-sm text-muted-foreground mb-4">Crea una banda para asignar grupos musicales a eventos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bands.map((band) => (
            <BandCard
              key={band.id}
              band={band}
              musicians={musicians}
              onDeactivate={handleDeactivate}
              onEdit={handleOpenEdit}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
            />
          ))}
        </div>
      )}
    </div>
  )
}
