import type { Notification } from "@/specs/entities"

const NOW = "2026-04-21T12:00:00.000Z"
const MINUS_2H = "2026-04-21T10:00:00.000Z"
const YESTERDAY = "2026-04-20T12:00:00.000Z"
const TWO_DAYS_AGO = "2026-04-19T12:00:00.000Z"

export const notificationFixtures = {
  newEvent: {
    id: "notif-1",
    title: "Nuevo evento asignado",
    message: "Se te ha asignado un nuevo evento: 'Acoustic Set - Lobby' para hoy a las 19:00",
    type: "info",
    timestamp: NOW,
    read: false,
    actionUrl: "/check-in/event-1",
    actionText: "Ver evento",
    eventId: "event-1",
  },
  checkInReminder: {
    id: "notif-2",
    title: "Recordatorio de check-in",
    message: "No olvides hacer check-in para tu presentación de hoy a las 21:30",
    type: "warning",
    timestamp: MINUS_2H,
    read: false,
    actionUrl: "/check-in/event-2",
    actionText: "Hacer check-in",
    eventId: "event-2",
  },
  checkInConfirmed: {
    id: "notif-3",
    title: "Check-in confirmado",
    message: "Tu check-in para 'Jazz Trio - Restaurante' ha sido registrado exitosamente",
    type: "success",
    timestamp: YESTERDAY,
    read: true,
    eventId: "event-2",
  },
  upcomingEvent: {
    id: "notif-4",
    title: "Evento próximo",
    message: "Tienes una presentación mañana: 'Solo Piano - Bar' a las 20:00",
    type: "info",
    timestamp: YESTERDAY,
    read: false,
    actionUrl: "/calendar",
    actionText: "Ver calendario",
    eventId: "event-3",
  },
  paymentProcessed: {
    id: "notif-5",
    title: "Pago procesado",
    message: "Se ha procesado el pago de $1,600 por tus presentaciones de la semana pasada",
    type: "success",
    timestamp: TWO_DAYS_AGO,
    read: true,
  },
  scheduleChange: {
    id: "notif-6",
    title: "Cambio de horario",
    message: "El evento 'Guitar Solo - Pool Bar' ha sido reprogramado para las 17:30",
    type: "warning",
    timestamp: TWO_DAYS_AGO,
    read: false,
    actionUrl: "/calendar",
    actionText: "Ver cambios",
    eventId: "event-5",
  },
} satisfies Record<string, Notification>

export const allNotifications: Notification[] = Object.values(notificationFixtures)
