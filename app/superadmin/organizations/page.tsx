"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Users, Hotel, Music, Calendar, Loader2, ExternalLink } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"
import { sileo } from "sileo"

type OrgRow = {
  id: string
  name: string
  slug: string
  status: string
  createdAt: string
  counts: { users: number; hotels: number; musicians: number; events: number }
}

export default function SuperAdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trpc.organizations.listAll.query()
      .then(setOrgs)
      .catch(() => sileo.error({ title: "Error", description: "No se pudo cargar la lista de organizaciones." }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Todas las organizaciones
        </h1>
        <p className="text-muted-foreground mt-1">Vista super-admin — acceso de solo lectura a todos los tenants</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando...
        </div>
      ) : orgs.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No hay organizaciones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Organización</th>
                <th className="text-left p-3 font-medium">Slug</th>
                <th className="text-center p-3 font-medium"><Users className="inline h-4 w-4" /> Managers</th>
                <th className="text-center p-3 font-medium"><Hotel className="inline h-4 w-4" /> Hoteles</th>
                <th className="text-center p-3 font-medium"><Music className="inline h-4 w-4" /> Músicos</th>
                <th className="text-center p-3 font-medium"><Calendar className="inline h-4 w-4" /> Eventos</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-left p-3 font-medium">Creada</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{org.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{org.slug}</td>
                  <td className="p-3 text-center">{org.counts.users}</td>
                  <td className="p-3 text-center">{org.counts.hotels}</td>
                  <td className="p-3 text-center">{org.counts.musicians}</td>
                  <td className="p-3 text-center">{org.counts.events}</td>
                  <td className="p-3">
                    <Badge variant={org.status === "active" ? "default" : "secondary"}>
                      {org.status === "active" ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString("es-MX")}
                  </td>
                  <td className="p-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/superadmin/organizations/${org.id}`}>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
