"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { TrendingUp, Download, Calendar, Users, DollarSign, BarChart2, FileText, BarChart3, Loader2, CheckCircle2, RotateCcw, AlertCircle } from "lucide-react"
import { trpc } from "@/shared/lib/trpc"
import { format, startOfMonth, isBefore, parseISO } from "date-fns"

const HOTEL_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

function getDefaultRange() {
  const today = new Date()
  const from = format(startOfMonth(today), "yyyy-MM-dd")
  const to = format(today, "yyyy-MM-dd")
  return { from, to }
}

type SummaryData = Awaited<ReturnType<typeof trpc.reports.summary.query>>
type PaymentsData = Awaited<ReturnType<typeof trpc.reports.payments.query>>
type PaymentEvent = PaymentsData["events"][number]

type PaymentFilter = "all" | "pending" | "paid"

export default function ReportsPage() {
  const defaultRange = getDefaultRange()
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [data, setData] = useState<SummaryData | null>(null)
  const [paymentsData, setPaymentsData] = useState<PaymentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all")
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})

  const { data: session } = useSession()
  const isManager = session?.user?.role === "manager"

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const fetchReport = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true)
    try {
      const [summaryResult, paymentsResult] = await Promise.all([
        trpc.reports.summary.query({ from: fromDate, to: toDate }),
        trpc.reports.payments.query({ from: fromDate, to: toDate }),
      ])
      setData(summaryResult)
      setPaymentsData(paymentsResult)
    } catch {
      // silently fail — data stays null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport(from, to)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkPaid = async (event: PaymentEvent) => {
    if (!isManager) return
    setUpdatingPayment(event.id)
    const notes = notesMap[event.id] ?? undefined

    // Optimistic update
    setPaymentsData((prev) => {
      if (!prev) return prev
      const updatedEvents = prev.events.map((e) =>
        e.id === event.id ? { ...e, paymentStatus: "paid" as const, paymentNotes: notes ?? null } : e,
      )
      const pendingTotal = updatedEvents
        .filter((e) => e.paymentStatus === "pending" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)
      const paidTotal = updatedEvents
        .filter((e) => e.paymentStatus === "paid" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)
      return { events: updatedEvents, pendingTotal, paidTotal }
    })

    try {
      await trpc.events.updatePaymentStatus.mutate({
        eventId: event.id,
        paymentStatus: "paid",
        paymentNotes: notes,
      })
    } catch {
      // Revert on error
      await fetchReport(from, to)
    } finally {
      setUpdatingPayment(null)
    }
  }

  const handleRevert = async (event: PaymentEvent) => {
    if (!isManager) return
    setUpdatingPayment(event.id)

    // Optimistic update
    setPaymentsData((prev) => {
      if (!prev) return prev
      const updatedEvents = prev.events.map((e) =>
        e.id === event.id ? { ...e, paymentStatus: "pending" as const } : e,
      )
      const pendingTotal = updatedEvents
        .filter((e) => e.paymentStatus === "pending" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)
      const paidTotal = updatedEvents
        .filter((e) => e.paymentStatus === "paid" && e.price !== null)
        .reduce((sum, e) => sum + (e.price ?? 0), 0)
      return { events: updatedEvents, pendingTotal, paidTotal }
    })

    try {
      await trpc.events.updatePaymentStatus.mutate({
        eventId: event.id,
        paymentStatus: "pending",
      })
    } catch {
      await fetchReport(from, to)
    } finally {
      setUpdatingPayment(null)
    }
  }

  const filteredPayments = paymentsData?.events.filter((e) => {
    if (paymentFilter === "pending") return e.paymentStatus === "pending"
    if (paymentFilter === "paid") return e.paymentStatus === "paid"
    return true
  }) ?? []

  const monthlyChartData = data?.byMonth.map((m) => ({
    month: m.month.slice(5), // "MM"
    eventos: m.events,
    sets: m.sets,
    pago: m.payout,
  })) ?? []

  const hotelChartData = data?.byHotel.map((h, i) => ({
    name: h.name,
    value: h.events,
    color: HOTEL_COLORS[i % HOTEL_COLORS.length],
  })) ?? []

  const LoadingSkeleton = () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes y Análisis</h1>
            <p className="text-gray-600">Dashboard de métricas y reportes automatizados</p>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label htmlFor="r-from" className="text-xs text-gray-500 mb-1 block">Desde</Label>
              <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            </div>
            <div>
              <Label htmlFor="r-to" className="text-xs text-gray-500 mb-1 block">Hasta</Label>
              <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
            </div>
            <Button onClick={() => fetchReport(from, to)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Actualizar
            </Button>
            <Button variant="outline" disabled title="Próximamente">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Eventos</p>
                  {loading ? (
                    <div className="h-8 w-12 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{data?.kpis.totalEvents ?? 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BarChart2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Sets Realizados</p>
                  {loading ? (
                    <div className="h-8 w-12 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{data?.kpis.totalSets ?? 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Por cobrar</p>
                  {loading ? (
                    <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">${(data?.kpis.pendingPayout ?? 0).toLocaleString("es-MX")}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasa de Check-in</p>
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{data?.kpis.checkInRate ?? 0}%</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Resumen General</TabsTrigger>
            <TabsTrigger value="musicians">Por Músico/Banda</TabsTrigger>
            <TabsTrigger value="hotels">Por Hotel</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="automated">Reportes Automáticos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {loading ? <LoadingSkeleton /> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia Mensual</CardTitle>
                    <CardDescription>Eventos y sets por mes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="eventos" fill="#3B82F6" name="Eventos" />
                        <Bar dataKey="sets" fill="#10B981" name="Sets" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Hotel Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución por Hotel</CardTitle>
                    <CardDescription>Número de eventos por hotel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hotelChartData.length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center">Sin datos para el período seleccionado</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={hotelChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {hotelChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Trends */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Evolución de Pagos</CardTitle>
                    <CardDescription>Pagos mensuales totales</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`$${Number(value).toLocaleString("es-MX")}`, "Pago"]} />
                        <Line type="monotone" dataKey="pago" stroke="#8B5CF6" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="musicians" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Desempeño por Músico / Banda</CardTitle>
                <CardDescription>Estadísticas detalladas de cada artista en el período</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <LoadingSkeleton /> : (
                  <div className="space-y-4">
                    {[...(data?.byMusician ?? []), ...(data?.byBand ?? [])].length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center">Sin datos para el período seleccionado</p>
                    ) : (
                      [...(data?.byMusician ?? []), ...(data?.byBand ?? [])].map((performer, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">{performer.name}</h3>
                              <p className="text-sm text-gray-600">
                                {performer.events} eventos • {performer.sets} sets
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${performer.payout.toLocaleString("es-MX")}</p>
                            <p className="text-sm text-gray-600">Pago total</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hotels" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Desglose por Hotel</CardTitle>
                <CardDescription>Eventos, sets y facturación por hotel en el período</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <LoadingSkeleton /> : (
                  <div className="space-y-4">
                    {(data?.byHotel ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center">Sin datos para el período seleccionado</p>
                    ) : (
                      (data?.byHotel ?? []).map((hotel, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">{hotel.name}</h3>
                            <p className="text-sm text-gray-600">{hotel.events} eventos • {hotel.sets} sets</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${hotel.revenue.toLocaleString("es-MX")}</p>
                            <p className="text-sm text-gray-600">Facturación</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagos" className="space-y-6">
            {/* Payment KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Por cobrar</p>
                      {loading ? (
                        <div className="h-8 w-28 bg-gray-100 rounded animate-pulse mt-1" />
                      ) : (
                        <p className="text-2xl font-bold text-amber-600">
                          ${(paymentsData?.pendingTotal ?? 0).toLocaleString("es-MX")}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Cobrado</p>
                      {loading ? (
                        <div className="h-8 w-28 bg-gray-100 rounded animate-pulse mt-1" />
                      ) : (
                        <p className="text-2xl font-bold text-green-600">
                          ${(paymentsData?.paidTotal ?? 0).toLocaleString("es-MX")}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status filter */}
            <div className="flex gap-2">
              {(["all", "pending", "paid"] as PaymentFilter[]).map((f) => (
                <Button
                  key={f}
                  variant={paymentFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentFilter(f)}
                >
                  {f === "all" ? "Todos" : f === "pending" ? "Pendiente" : "Pagado"}
                </Button>
              ))}
            </div>

            {/* Payments list */}
            <Card>
              <CardHeader>
                <CardTitle>Eventos y Pagos</CardTitle>
                <CardDescription>Estado de cobro por evento en el período seleccionado</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <LoadingSkeleton /> : filteredPayments.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">Sin datos para el período seleccionado</p>
                ) : (
                  <div className="space-y-3">
                    {filteredPayments.map((event) => {
                      const isOverdue =
                        event.paymentStatus === "pending" &&
                        isBefore(parseISO(event.date), today)
                      const isPending = event.paymentStatus === "pending"
                      const isUpdating = updatingPayment === event.id

                      return (
                        <div
                          key={event.id}
                          className={`p-4 border rounded-lg ${isOverdue ? "border-red-200 bg-red-50" : "bg-white"}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            {/* Event info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm">{event.date}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-sm text-gray-700 truncate">{event.hotel}</span>
                                {event.performer && (
                                  <>
                                    <span className="text-gray-400">·</span>
                                    <span className="text-sm text-gray-700">{event.performer}</span>
                                  </>
                                )}
                                <span className="text-gray-400">·</span>
                                <span className="text-sm text-gray-500">{event.sets} set{event.sets !== 1 ? "s" : ""}</span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Payment status badge */}
                                {isPending ? (
                                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                                    Pendiente
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                                    Pagado
                                  </Badge>
                                )}

                                {/* Overdue badge */}
                                {isOverdue && (
                                  <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                                    Vencido
                                  </Badge>
                                )}

                                {/* Amount */}
                                <span className="text-sm font-semibold">
                                  {event.price !== null
                                    ? `$${event.price.toLocaleString("es-MX")}`
                                    : "—"}
                                </span>
                              </div>

                              {/* Notes (read-only display when paid) */}
                              {event.paymentNotes && (
                                <p className="text-xs text-gray-500 mt-1">{event.paymentNotes}</p>
                              )}
                            </div>

                            {/* Actions — managers only */}
                            {isManager && (
                              <div className="flex flex-col gap-2 min-w-[160px]">
                                {isPending ? (
                                  <>
                                    <Textarea
                                      placeholder="Referencia de pago (opcional)"
                                      className="text-xs h-16 resize-none"
                                      value={notesMap[event.id] ?? ""}
                                      onChange={(e) =>
                                        setNotesMap((prev) => ({ ...prev, [event.id]: e.target.value }))
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      className="w-full bg-green-600 hover:bg-green-700"
                                      disabled={isUpdating}
                                      onClick={() => handleMarkPaid(event)}
                                    >
                                      {isUpdating ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                      )}
                                      Marcar como Pagado
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-gray-500 hover:text-gray-700 w-full"
                                    disabled={isUpdating}
                                    onClick={() => handleRevert(event)}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                    )}
                                    Revertir
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automated" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Reportes Semanales
                  </CardTitle>
                  <CardDescription>Reportes automáticos enviados cada lunes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Esta función estará disponible próximamente.</p>
                  </div>
                  <Button disabled className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Generar Reporte Semanal
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Reportes Mensuales
                  </CardTitle>
                  <CardDescription>Análisis completo mensual</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Esta función estará disponible próximamente.</p>
                  </div>
                  <Button variant="outline" disabled className="w-full bg-transparent">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Reporte Mensual
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
