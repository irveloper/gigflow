"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useUnit } from "effector-react"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus, Music, Phone, Mail, DollarSign, AlertTriangle,
  Link2, Link2Off, Search, Loader2, ExternalLink, Trash2, SendHorizonal,
} from "lucide-react"
import { $user } from "@/entities/user/model"
import { $organization } from "@/entities/organization/model"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"
import type { Musician } from "@/shared/types"

const EMPTY_FORM = {
  name: "", email: "", phone: "", instruments: "", styles: "", hourlyRate: 0, isActive: true, avatar: "",
}

function MusicianCard({
  musician,
  linked,
  slug,
  onLink,
  onUnlink,
  onDelete,
  onInvite,
  linking,
  inviting,
}: {
  musician: Musician
  linked: boolean
  slug: string
  onLink: (id: string) => void
  onUnlink: (id: string) => void
  onDelete: (id: string) => void
  onInvite: (id: string, email: string) => void
  linking: boolean
  inviting: boolean
}) {
  const initials = musician.name.split(" ").map((n) => n[0]).join("").toUpperCase()
  return (
    <Card className={musician.isActive ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={musician.avatar ?? "/placeholder.svg"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{musician.name}</p>
              <Badge variant={musician.isActive ? "default" : "secondary"} className="shrink-0">
                {musician.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {musician.instruments.slice(0, 2).map((inst) => (
                <Badge key={inst} variant="outline" className="text-xs">{inst}</Badge>
              ))}
              {musician.styles.slice(0, 2).map((style) => (
                <Badge key={style} variant="secondary" className="text-xs">{style}</Badge>
              ))}
            </div>
          </div>
          {linked && (
            <div className="flex items-center gap-1 shrink-0">
              <Link href={`/org/${slug}/admin/musicians/${musician.id}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => onInvite(musician.id, musician.email)}
                disabled={inviting || linking}
                title="Invitar al portal"
              >
                {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <SendHorizonal className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(musician.id)}
                disabled={linking}
                title="Eliminar músico"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{musician.email}</div>
          <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{musician.phone}</div>
          <div className="flex items-center gap-2"><DollarSign className="h-3 w-3" />${musician.hourlyRate}/hr</div>
        </div>
        <div className="pt-2 border-t">
          {linked ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onUnlink(musician.id)}
              disabled={linking}
            >
              <Link2Off className="h-3 w-3 mr-1" />
              Desconectar
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={() => onLink(musician.id)} disabled={linking}>
              {linking ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminMusiciansManager() {
  const params = useParams<{ slug: string }>()
  const [user, organization] = useUnit([$user, $organization])
  const slug = params?.slug ?? organization?.slug ?? ""

  const [linked, setLinked] = useState<Musician[]>([])
  const [linkedTotal, setLinkedTotal] = useState(0)
  const [linkedOffset, setLinkedOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Musician[]>([])
  const [searching, setSearching] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const linkedIds = new Set(linked.map((m) => m.id))

  const PAGE_SIZE = 50

  const fetchLinked = useCallback(async (offset = 0) => {
    try {
      const data = await trpc.musicians.getAll.query({ limit: PAGE_SIZE, offset })
      if (offset === 0) {
        setLinked(data.items)
      } else {
        setLinked((prev) => [...prev, ...data.items])
      }
      setLinkedTotal(data.total)
      setLinkedOffset(offset)
    } catch {
      sileo.error({ title: "Error", description: "No se pudo cargar la lista de músicos." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinked(0) }, [fetchLinked])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await trpc.musicians.search.query({ query: searchQuery })
        setSearchResults(data)
      } catch {
        sileo.error({ title: "Error", description: "Error al buscar músicos." })
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleLink = async (musicianId: string) => {
    setLinkingId(musicianId)
    try {
      await trpc.musicians.linkMusician.mutate({ musicianId })
      sileo.success({ title: "Músico conectado", description: "El músico fue agregado a tu organización." })
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al conectar músico." })
    } finally {
      setLinkingId(null)
    }
  }

  const handleUnlink = async (musicianId: string) => {
    if (!confirm("¿Desconectar este músico de tu organización?")) return
    setLinkingId(musicianId)
    try {
      await trpc.musicians.unlinkMusician.mutate({ musicianId })
      sileo.success({ title: "Músico desconectado" })
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al desconectar músico." })
    } finally {
      setLinkingId(null)
    }
  }

  const handleInvite = (musicianId: string, email: string) => {
    sileo.action({
      title: "Invitar al portal",
      description: `¿Enviar enlace de activación a ${email}?`,
      duration: null,
      button: {
        title: "Enviar invitación",
        onClick: async () => {
          setInvitingId(musicianId)
          try {
            await sileo.promise(
              () => trpc.musicians.invite.mutate({ musicianId }),
              {
                loading: { title: "Enviando invitación..." },
                success: {
                  title: "Invitación enviada",
                  description: `Enlace activo 72h → ${email}`,
                },
                error: (err) => ({
                  title: "Error al invitar",
                  description: err instanceof Error ? err.message : "No se pudo enviar la invitación.",
                }),
              },
            )
            await fetchLinked(0)
          } catch {
            // error already shown by sileo.promise
          } finally {
            setInvitingId(null)
          }
        },
      },
    })
  }

  const handleDelete = async (musicianId: string) => {
    if (!confirm("¿Eliminar este músico de tu organización? Si ninguna otra organización lo usa, se borrará permanentemente.")) return
    setLinkingId(musicianId)
    try {
      await trpc.musicians.delete.mutate({ id: musicianId })
      sileo.success({ title: "Músico eliminado" })
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al eliminar músico." })
    } finally {
      setLinkingId(null)
    }
  }

  const handleCreate = async () => {
    const { name, email, phone, instruments, styles, hourlyRate, isActive, avatar } = form
    if (!name || !email || !phone) {
      sileo.error({ title: "Error", description: "Completa todos los campos obligatorios." })
      return
    }
    setCreating(true)
    try {
      await trpc.musicians.create.mutate({
        name, email, phone,
        instruments: instruments.split(",").map((s) => s.trim()).filter(Boolean),
        styles: styles.split(",").map((s) => s.trim()).filter(Boolean),
        hourlyRate: Number(hourlyRate),
        isActive,
        avatar: avatar || undefined,
      })
      sileo.success({ title: "Músico creado", description: `${name} fue creado y conectado a tu organización.` })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      await fetchLinked(0)
    } catch (err) {
      sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error al crear músico." })
    } finally {
      setCreating(false)
    }
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
          <h1 className="text-2xl font-bold">Gestión de Músicos</h1>
          <p className="text-muted-foreground mt-1">Conecta músicos a tu organización para asignarlos a eventos</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Músico</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear y conectar músico</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="m-name">Nombre completo *</Label>
                <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="m-email">Email *</Label>
                <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="m-phone">Teléfono *</Label>
                <Input id="m-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="m-rate">Tarifa por hora ($)</Label>
                <Input id="m-rate" type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="m-instruments">Instrumentos</Label>
                <Input id="m-instruments" value={form.instruments} onChange={(e) => setForm({ ...form, instruments: e.target.value })} placeholder="Guitarra, Piano, ..." />
                <p className="text-xs text-muted-foreground mt-1">Separa con comas</p>
              </div>
              <div>
                <Label htmlFor="m-styles">Estilos musicales</Label>
                <Input id="m-styles" value={form.styles} onChange={(e) => setForm({ ...form, styles: e.target.value })} placeholder="Jazz, Flamenco, ..." />
                <p className="text-xs text-muted-foreground mt-1">Separa con comas</p>
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
            Mis Músicos {!loading && <Badge variant="secondary" className="ml-1">{linked.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="search">Buscar Músico</TabsTrigger>
        </TabsList>

        <TabsContent value="linked" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando...
            </div>
          ) : linked.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-40 text-muted-foreground" />
                <p className="font-medium mb-1">No tienes músicos conectados</p>
                <p className="text-sm text-muted-foreground mb-4">Usa la pestaña "Buscar Músico" o crea uno nuevo.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {linked.map((m) => (
                  <MusicianCard
                    key={m.id}
                    musician={m}
                    linked
                    slug={slug}
                    onLink={handleLink}
                    onUnlink={handleUnlink}
                    onDelete={handleDelete}
                    onInvite={handleInvite}
                    linking={linkingId === m.id}
                    inviting={invitingId === m.id}
                  />
                ))}
              </div>
              {linked.length < linkedTotal && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => fetchLinked(linkedOffset + PAGE_SIZE)}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Cargar más ({linked.length}/{linkedTotal})
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
              placeholder="Buscar músicos en la plataforma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((m) => (
                <MusicianCard
                  key={m.id}
                  musician={m}
                  linked={linkedIds.has(m.id)}
                  slug={slug}
                  onLink={handleLink}
                  onUnlink={handleUnlink}
                  onDelete={handleDelete}
                  onInvite={handleInvite}
                  linking={linkingId === m.id}
                  inviting={invitingId === m.id}
                />
              ))}
            </div>
          )}

          {searchQuery && !searching && searchResults.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No se encontraron músicos para "{searchQuery}"</p>
          )}

          {!searchQuery && (
            <p className="text-center text-muted-foreground py-8">Escribe el nombre de un músico para buscarlo</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
