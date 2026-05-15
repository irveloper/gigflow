"use client"

import { useUnit } from "effector-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Calendar, Home, Hotel, Music, Settings, BarChart3, LogOut } from "lucide-react"
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
import { logout } from "@/features/auth/model"

const navigationItems = {
  musician: [
    { href: "/", icon: Home, label: "Inicio" },
    { href: "/calendar", icon: Calendar, label: "Calendario" },
    { href: "/notifications", icon: Bell, label: "Notificaciones" },
    { href: "/profile", icon: Settings, label: "Perfil" },
  ],
  manager: [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/calendar", icon: Calendar, label: "Calendario" },
    { href: "/reports", icon: BarChart3, label: "Reportes" },
    { href: "/notifications", icon: Bell, label: "Notificaciones" },
  ],
  hotel: [
    { href: "/hotel/dashboard", icon: Home, label: "Dashboard" },
    { href: "/calendar", icon: Calendar, label: "Eventos" },
    { href: "/notifications", icon: Bell, label: "Notificaciones" },
  ],
  admin: [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/admin/events", icon: Calendar, label: "Eventos" },
    { href: "/admin/musicians", icon: Music, label: "Músicos" },
    { href: "/admin/hotels", icon: Hotel, label: "Hoteles" },
    { href: "/reports", icon: BarChart3, label: "Reportes" },
    { href: "/notifications", icon: Bell, label: "Notificaciones" },
  ],
}

export function Navigation() {
  const [user, userRole, unreadCount] = useUnit([$user, $userRole, $unreadCount])
  const pathname = usePathname()

  if (!user || !userRole) return null

  const items = navigationItems[userRole] || []

  const handleLogout = () => {
    logout()
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2">
            <Music className="h-6 w-6" />
            <span className="font-bold">Music Platform</span>
          </Link>

          <div className="hidden md:flex items-center space-x-4">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const showBadge = item.href === "/notifications" && unreadCount > 0

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
              <Link href="/profile">
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
