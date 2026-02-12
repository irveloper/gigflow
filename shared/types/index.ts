export interface User {
  id: string
  email: string
  name: string
  role: "musician" | "manager" | "hotel"
  avatar?: string
  phone?: string
  shows?: string[]
  hourlyRate?: number
  hotel?: string
  location?: string
  contactPerson?: string
  isActive?: boolean
  createdAt: string
}

export interface Event {
  id: string
  title: string
  description?: string
  date: string
  startTime: string
  endTime: string
  location: string
  musicianId?: string
  hotelId?: string
  status: "scheduled" | "in-progress" | "completed" | "cancelled"
  checkInTime?: string
  checkInPhoto?: string
  createdAt: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  userId: string
  isRead: boolean
  createdAt: string
}

export interface Musician {
  id: string
  name: string
  email: string
  phone: string
  shows: string[]
  hourlyRate: number
  isActive: boolean
  avatar?: string
  createdAt: string
}

export interface Hotel {
  id: string
  name: string
  email: string
  phone: string
  location: string
  contactPerson: string
  isActive: boolean
  avatar?: string
  createdAt: string
}
