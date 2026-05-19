"use client"

import { useUnit } from "effector-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Calendar, Home, Hotel, Music, Music2, Settings, BarChart3, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { $user, $userRole } from "@/entities/user/model"
import { $unreadCount } from "@/entities/notification/model"
import { $organization } from "@/entities/organization/model"
import { logout } from "@/features/auth/model"

function buildNavItems(prefix: string) {
  return {
    musician: [
      { href: `${prefix}/`, icon: Home, label: "Inicio" },
      { href: `${prefix}/calendar`, icon: Calendar, label: "Calendario" },
      { href: `${prefix}/notifications`, icon: Bell, label: "Notificaciones" },
      { href: `${prefix}/profile`, icon: Settings, label: "Perfil" },
    ],
    manager: [
      { href: `${prefix}/`, icon: Home, label: "Dashboard" },
      { href: `${prefix}/calendar`, icon: Calendar, label: "Calendario" },
      { href: `${prefix}/reports`, icon: BarChart3, label: "Reportes" },
      { href: `${prefix}/notifications`, icon: Bell, label: "Notificaciones" },
    ],
    hotel: [
      { href: `${prefix}/hotel/dashboard`, icon: Home, label: "Dashboard" },
      { href: `${prefix}/calendar`, icon: Calendar, label: "Eventos" },
      { href: `${prefix}/notifications`, icon: Bell, label: "Notificaciones" },
    ],
    admin: [
      { href: `${prefix}/`, icon: Home, label: "Dashboard" },
      { href: `${prefix}/admin/events`, icon: Calendar, label: "Eventos" },
      { href: `${prefix}/admin/musicians`, icon: Music, label: "Músicos" },
      { href: `${prefix}/admin/bands`, icon: Music2, label: "Bandas" },
      { href: `${prefix}/admin/hotels`, icon: Hotel, label: "Hoteles" },
      { href: `${prefix}/reports`, icon: BarChart3, label: "Reportes" },
      { href: `${prefix}/notifications`, icon: Bell, label: "Notificaciones" },
    ],
  }
}

export function Navigation() {
  const [user, userRole, unreadCount, organization] = useUnit([$user, $userRole, $unreadCount, $organization])
  const pathname = usePathname()

  if (!user || !userRole) return null

  const prefix = user?.organizationSlug
    ? `/org/${user.organizationSlug}`
    : organization?.slug
      ? `/org/${organization.slug}`
      : ""
  const navigationItems = buildNavItems(prefix)
  const items = navigationItems[userRole] || []

  const handleLogout = () => {
    logout()
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href={prefix || "/"} className="flex items-center space-x-2">
            <Music className="h-6 w-6" />
            <span className="font-bold">Music Platform</span>
          </Link>

          <div className="hidden md:flex items-center space-x-4">
            {items.map((item) => {
              const Icon = item.icon
              const normalizedHref = item.href.replace(/\/$/, "") || "/"
              const normalizedPath = pathname.replace(/\/$/, "") || "/"
              const isActive = normalizedPath === normalizedHref
              const showBadge = item.href.endsWith("/notifications") && unreadCount > 0

              return (
                <Link key={item.href} href={item.href}>
                  <Button variant={isActive ? "default" : "ghost"} size="sm" className="relative">
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                    {showBadge && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar ?? "/placeholder.svg"} alt={user.name} />
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`${prefix}/profile`}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
