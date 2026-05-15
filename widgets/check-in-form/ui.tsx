"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Camera, Clock, MapPin, Upload, CheckCircle, ArrowLeft, AlertTriangle } from "lucide-react"
import { eventsModel } from "@/features/events/model"
import { submitCheckIn, $isCheckingIn } from "@/features/check-in/model"
import { sileo } from "sileo"
import type { Event } from "@/shared/types"

interface CheckInFormProps {
  eventId: string
}

export function CheckInForm({ eventId }: CheckInFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [comments, setComments] = useState("")
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const { events, isLoading } = useUnit({
    events: eventsModel.$events,
    isLoading: $isCheckingIn,
  })

  const event = events.find((e) => e.id === eventId)

  const currentTime = new Date().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  })

  useEffect(() => {
    if ("geolocation" in navigator) {
      setLocationLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setLocationLoading(false)
        },
        (error) => {
          console.error("Error getting location", error)
          setLocationLoading(false)
        }
      )
    }
  }, [])

  const isTimeWarning = event?.time ? (() => {
    const [h, m] = event.time.split(':').map(Number)
    const now = new Date()
    const eventDate = new Date()
    eventDate.setHours(h, m, 0, 0)
    const diffMins = (now.getTime() - eventDate.getTime()) / (1000 * 60)
    return diffMins < -60 || diffMins > 60
  })() : false

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        sileo.error({ title: "Error", description: "La imagen debe ser menor a 5MB" })
        return
      }

      setSelectedPhoto(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCheckIn = async () => {
    if (!selectedPhoto || !event) return

    submitCheckIn({
      eventId: event.id,
      photo: selectedPhoto,
      timestamp: new Date().toISOString(),
      ...(location ? { location } : {}),
      ...(comments ? { comments } : {}),
    })

    sileo.success({ title: "Check-in exitoso", description: "Tu presentación ha sido registrada correctamente" })

    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando evento...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Evento no encontrado</h2>
            <p className="text-gray-600 mb-4">El evento que buscas no existe o ha sido eliminado.</p>
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (event.checkedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Check-in completado</h2>
            <p className="text-gray-600 mb-4">Ya realizaste el check-in para este evento.</p>
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check-in del Evento</h1>
          <p className="text-gray-600">Registra tu llegada con una foto de evidencia</p>
        </div>

        <div className="space-y-6">
          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Información del Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg">{event.title}</h3>
                {event.description && <p className="text-gray-600">{event.description}</p>}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {event.time}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.hotel}
                </div>
              </div>

              <Badge variant="outline">Hora actual: {currentTime}</Badge>

              {isTimeWarning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm mt-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  La hora actual está fuera del rango normal para este evento.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Foto de Evidencia
              </CardTitle>
              <CardDescription>Toma una foto del lugar donde realizarás tu presentación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {!photoPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Haz clic para tomar/seleccionar foto</p>
                  <p className="text-sm text-gray-500">JPEG o PNG, máximo 5MB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute top-2 right-2"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Cambiar
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Foto seleccionada correctamente</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comentarios (Opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="¿Hubo algún problema o retraso al llegar?" 
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <Card>
            <CardContent className="p-6">
              <Button onClick={handleCheckIn} disabled={!selectedPhoto || isLoading} className="w-full" size="lg">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Confirmar Check-in
                  </>
                )}
              </Button>

              {!selectedPhoto && (
                <p className="text-sm text-gray-500 text-center mt-2">Selecciona una foto para continuar</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
