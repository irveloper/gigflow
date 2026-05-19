"use client"

import { useEffect, useState } from "react"
import { useUnit } from "effector-react"
import { $user } from "@/entities/user/model"
import { trpc } from "@/shared/lib/trpc"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertTriangle, Plus, UserX, UserCheck, Users } from "lucide-react"
import { sileo } from "sileo"

type UserRow = {
  id: string
  name: string
  email: string
  role: string | null
  isActive: boolean
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  musician: "Músico",
  manager: "Gerente",
  hotel: "Hotel",
}

export default function AdminUsersPage() {
  const currentUser = useUnit($user)

  const [users, setUsers] = useState<UserRow[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersOffset, setUsersOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const PAGE_SIZE = 50
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "" as "musician" | "manager" | "hotel" | "",
    phone: "",
  })

  async function fetchUsers(offset = 0) {
    try {
      const data = await trpc.admin.listUsers.query({ limit: PAGE_SIZE, offset })
      if (offset === 0) {
        setUsers(data.items)
      } else {
        setUsers((prev) => [...prev, ...data.items])
      }
      setUsersTotal(data.total)
      setUsersOffset(offset)
    } catch {
      sileo.error({ title: "Error", description: "No se pudo cargar la lista de usuarios." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(0)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.role) {
      sileo.error({ title: "Error", description: "Completa todos los campos obligatorios." })
      return
    }
    setSubmitting(true)
    try {
      await trpc.admin.createUser.mutate({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role as "musician" | "manager" | "hotel",
        phone: form.phone || undefined,
      })
      sileo.success({ title: "Usuario creado", description: `${form.name} ha sido creado correctamente.` })
      setDialogOpen(false)
      setForm({ name: "", email: "", password: "", role: "", phone: "" })
      await fetchUsers(0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo crear el usuario."
      sileo.error({ title: "Error", description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`¿Desactivar la cuenta de ${name}?`)) return
    try {
      await trpc.admin.deactivateUser.mutate({ id })
      sileo.success({ title: "Usuario desactivado", description: `${name} ha sido desactivado.` })
      await fetchUsers(0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo desactivar el usuario."
      sileo.error({ title: "Error", description: msg })
    }
  }

  async function handleReactivate(id: string, name: string) {
    if (!confirm(`¿Reactivar la cuenta de ${name}?`)) return
    try {
      await trpc.admin.reactivateUser.mutate({ id })
      sileo.success({ title: "Usuario reactivado", description: `${name} ha sido reactivado.` })
      await fetchUsers(0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo reactivar el usuario."
      sileo.error({ title: "Error", description: msg })
    }
  }

  if (!currentUser || currentUser.role !== "manager") {
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-8 w-8" />
            Gestión de Usuarios
          </h1>
          <p className="text-gray-600 mt-1">Administra todas las cuentas de la plataforma</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Crear Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nueva cuenta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="u-name">Nombre completo *</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="u-email">Email *</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="u-role">Rol *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v: "musician" | "manager" | "hotel") => setForm({ ...form, role: v })}
                >
                  <SelectTrigger id="u-role">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="musician">Músico</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="u-phone">Teléfono</Label>
                <Input
                  id="u-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="u-password">Contraseña temporal *</Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-sm">Cargando...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay usuarios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-gray-600">Nombre</th>
                    <th className="pb-2 pr-4 font-medium text-gray-600">Email</th>
                    <th className="pb-2 pr-4 font-medium text-gray-600">Rol</th>
                    <th className="pb-2 pr-4 font-medium text-gray-600">Estado</th>
                    <th className="pb-2 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{u.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                      <td className="py-3 pr-4">
                        {u.role ? (
                          <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={u.isActive ? "default" : "destructive"}>
                          {u.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {u.isActive && u.id !== currentUser.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(u.id, u.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Desactivar
                          </Button>
                        )}
                        {!u.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivate(u.id, u.name)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Reactivar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length < usersTotal && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchUsers(usersOffset + PAGE_SIZE)}
                    disabled={loading}
                  >
                    Cargar más ({users.length}/{usersTotal})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
