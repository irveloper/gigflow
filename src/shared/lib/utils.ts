import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date))
}

export function formatTime(time: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(`2000-01-01T${time}`))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount)
}

/**
 * Generate a URL-safe slug from a name.
 * Lowercase, alphanumeric + hyphens, max 50 chars, no leading/trailing/consecutive hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")    // remove non-alphanumeric except spaces/hyphens
    .trim()
    .replace(/[\s-]+/g, "-")          // spaces and hyphens → single hyphen
    .replace(/^-+|-+$/g, "")          // strip leading/trailing hyphens
    .slice(0, 50)
    .replace(/-+$/, "")               // strip trailing hyphen after slice
}
