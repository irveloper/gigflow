"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Building2, Users, Hotel, Music, Calendar, Loader2,
  ArrowLeft, Mail, MapPin, User,
} from "lucide-react"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"

type OrgDetail = Awaited<ReturnType<typeof trpc.organizations.getOrgDetail.query>>

export default function SuperAdminOrgDetailPage() {
  const params = useParams<{ orgId: string }>()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trpc.organizations.getOrgDetail.query({ orgId: params.orgId })
      .then(setOrg)
      .catch(() => sileo.error({ title: "Error", description: "No se pudo cargar la organización." }))
      .finally(() => setLoading(false))
  }, [params.orgId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando...
      </div>
    )
  }

  if (!org) {
    return <p className="text-center text-muted-foreground py-12">Organización no encontrada.</p>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/superadmin/organizations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />{org.name}
          </h1>
          <p className="text-muted-foreground text-sm font-mono">{org.slug} &mdash;{" "}
            <Badge variant={org.status === "active" ? "default" : "secondary"} className="ml-1">
              {org.status === "active" ? "Activo" : "Inactivo"}
            </Badge>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />Managers ({org.users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {org.users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin usuarios.</p>
            ) : (
              <ul className="space-y-2">
                {org.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />{u.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{u.role}</Badge>
                      {!u.isActive && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Hotels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hotel className="h-4 w-4" />Hoteles ({org.hotels.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {org.hotels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin hoteles vinculados.</p>
            ) : (
              <ul className="space-y-2">
                {org.hotels.map((h) => (
                  <li key={h.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{h.name}</span>
                      {!h.isActive && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                    </div>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" />{h.location}
                    </p>
                    {h.contactPerson && (
                      <p className="text-muted-foreground text-xs">Contacto: {h.contactPerson}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Musicians */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />Músicos ({org.musicians.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {org.musicians.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin músicos vinculados.</p>
            ) : (
              <ul className="space-y-2">
                {org.musicians.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">{m.instruments.join(", ")}</span>
                    </div>
                    {!m.isActive && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />Eventos ({org.events.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {org.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos.</p>
            ) : (
              <ul className="space-y-2">
                {org.events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{e.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {new Date(e.date).toLocaleDateString("es-MX")} {e.time}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">{e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
