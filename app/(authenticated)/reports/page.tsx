"use client"

import { useState } from "react"
import { useUnit } from "effector-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { TrendingUp, Download, Calendar, Users, DollarSign, Clock, FileText, BarChart3 } from "lucide-react"
import { eventsModel } from "@/features/events/model"
import { $user } from "@/entities/user/model"

export default function ReportsPage() {
  const user = useUnit($user)
  const events = useUnit(eventsModel.$events)

  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [selectedYear, setSelectedYear] = useState("2024")

  // Mock data for charts
  const monthlyData = [
    { month: "Ene", eventos: 45, horas: 90, pago: 72000 },
    { month: "Feb", eventos: 52, horas: 104, pago: 83200 },
    { month: "Mar", eventos: 48, horas: 96, pago: 76800 },
    { month: "Abr", eventos: 55, horas: 110, pago: 88000 },
    { month: "May", eventos: 61, horas: 122, pago: 97600 },
    { month: "Jun", eventos: 58, horas: 116, pago: 92800 },
  ]

  const musicianPerformance = [
    { name: "Carlos Mendoza", eventos: 24, horas: 48, pago: 38400, tasa: 96 },
    { name: "Ana Rodríguez", eventos: 18, horas: 36, pago: 27000, tasa: 94 },
    { name: "Miguel Santos", eventos: 15, horas: 30, pago: 21000, tasa: 87 },
    { name: "Laura García", eventos: 12, horas: 24, pago: 19200, tasa: 92 },
  ]

  const hotelDistribution = [
    { name: "Paradisus Cancún", value: 35, color: "#3B82F6" },
    { name: "Moon Palace", value: 28, color: "#10B981" },
    { name: "Xcaret", value: 22, color: "#F59E0B" },
    { name: "Iberostar", value: 15, color: "#EF4444" },
  ]

  const conceptDistribution = [
    { name: "Acoustic Set", value: 30, color: "#8B5CF6" },
    { name: "Jazz Trio", value: 25, color: "#06B6D4" },
    { name: "Solo Piano", value: 20, color: "#84CC16" },
    { name: "Vocal Jazz", value: 15, color: "#F97316" },
    { name: "Otros", value: 10, color: "#6B7280" },
  ]

  const generatePDFReport = () => {
    // Simulate PDF generation
    const reportData = {
      period: selectedPeriod,
      year: selectedYear,
      totalEvents: events.length,
      totalHours: events.length * 2,
      totalPayment: events.length * 1600,
      musicians: musicianPerformance,
      hotels: hotelDistribution,
    }

    console.log("Generating PDF report with data:", reportData)

    // In a real app, this would generate and download a PDF
    alert("Reporte PDF generado exitosamente (simulación)")
  }

  const generateWeeklyReport = () => {
    // Simulate weekly report generation
    alert("Reporte semanal enviado por email (simulación)")
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes y Análisis</h1>
            <p className="text-gray-600">Dashboard de métricas y reportes automatizados</p>
          </div>

          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensual</SelectItem>
                <SelectItem value="quarter">Trimestral</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={generatePDFReport}>
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
                  <p className="text-sm font-medium text-gray-600">Eventos Este Mes</p>
                  <p className="text-2xl font-bold">58</p>
                  <p className="text-xs text-green-600">+12% vs mes anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Horas Trabajadas</p>
                  <p className="text-2xl font-bold">116</p>
                  <p className="text-xs text-green-600">+8% vs mes anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Pago Estimado</p>
                  <p className="text-2xl font-bold">$92,800</p>
                  <p className="text-xs text-green-600">+15% vs mes anterior</p>
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
                  <p className="text-2xl font-bold">94%</p>
                  <p className="text-xs text-green-600">+2% vs mes anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen General</TabsTrigger>
            <TabsTrigger value="musicians">Por Músico</TabsTrigger>
            <TabsTrigger value="hotels">Por Hotel</TabsTrigger>
            <TabsTrigger value="automated">Reportes Automáticos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia Mensual</CardTitle>
                  <CardDescription>Eventos y horas trabajadas por mes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="eventos" fill="#3B82F6" name="Eventos" />
                      <Bar dataKey="horas" fill="#10B981" name="Horas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Hotel Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Hotel</CardTitle>
                  <CardDescription>Porcentaje de eventos por hotel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={hotelDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {hotelDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Payment Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Evolución de Pagos</CardTitle>
                <CardDescription>Estimación de pagos mensuales</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, "Pago"]} />
                    <Line type="monotone" dataKey="pago" stroke="#8B5CF6" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="musicians" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Desempeño por Músico</CardTitle>
                <CardDescription>Estadísticas detalladas de cada artista</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {musicianPerformance.map((musician, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">{musician.name}</h3>
                          <p className="text-sm text-gray-600">
                            {musician.eventos} eventos • {musician.horas} horas
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">${musician.pago.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">Pago estimado</p>
                        </div>

                        <Badge
                          variant={musician.tasa >= 95 ? "default" : musician.tasa >= 90 ? "secondary" : "outline"}
                        >
                          {musician.tasa}% puntualidad
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hotels" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Eventos por Hotel</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hotelDistribution} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conceptos Musicales</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={conceptDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${value}%`}
                      >
                        {conceptDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
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
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">Próximo Reporte</h4>
                    <p className="text-sm text-blue-700">Lunes 5 de Agosto, 2024</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Incluye: eventos completados, check-ins, pagos estimados
                    </p>
                  </div>

                  <Button onClick={generateWeeklyReport} className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Generar Reporte Semanal Ahora
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Reportes Mensuales
                  </CardTitle>
                  <CardDescription>Análisis completo enviado el primer día de cada mes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900">Último Reporte</h4>
                    <p className="text-sm text-green-700">1 de Julio, 2024</p>
                    <p className="text-xs text-green-600 mt-1">
                      Incluye: análisis de desempeño, tendencias, recomendaciones
                    </p>
                  </div>

                  <Button variant="outline" className="w-full bg-transparent">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Último Reporte
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Configuración de Reportes</CardTitle>
                <CardDescription>Personaliza la frecuencia y contenido de los reportes automáticos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Reporte Semanal de Actividad</h4>
                      <p className="text-sm text-gray-600">Enviado cada lunes a las 8:00 AM</p>
                    </div>
                    <Badge variant="default">Activo</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Reporte Mensual de Desempeño</h4>
                      <p className="text-sm text-gray-600">Enviado el primer día de cada mes</p>
                    </div>
                    <Badge variant="default">Activo</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Alertas de Check-in Faltantes</h4>
                      <p className="text-sm text-gray-600">Notificación inmediata por eventos sin check-in</p>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
