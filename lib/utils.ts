import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return "-"
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
  }).format(amount)
}

/**
 * Форматирует метраж, сохраняя точность до 1 знака после запятой
 * Убирает лишние нули в конце (85.6 вместо 85.60, но 85.0 остается 85.0)
 */
export function formatMeterage(meterage: number | null | undefined): string {
  if (meterage === null || meterage === undefined) return "-"
  // Используем toFixed(1) для одного знака после запятой, затем убираем лишние нули
  const formatted = meterage.toFixed(1)
  // Убираем .0 в конце, но оставляем .1, .2 и т.д.
  return formatted.replace(/\.0$/, '') || formatted
}



