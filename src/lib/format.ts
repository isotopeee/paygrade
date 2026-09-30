import { format, formatDistanceToNowStrict, parseISO } from "date-fns"

import type { Centavos, ISODate } from "@/types"

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
})

const currencyCompact = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 2,
})

const plainNumber = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integer = new Intl.NumberFormat("en-PH")

/** Format centavos as Philippine pesos, for example ₱12,345.67. */
export function formatCurrency(amount: Centavos): string {
  return currency.format(amount / 100)
}

/** Compact peso format for KPIs and chart axes, for example ₱4.52M. */
export function formatCurrencyCompact(amount: Centavos): string {
  return currencyCompact.format(amount / 100)
}

/** Peso amount without the currency sign, for dense registers and exports. */
export function formatAmount(amount: Centavos): string {
  return plainNumber.format(amount / 100)
}

export function formatNumber(value: number): string {
  return integer.format(value)
}

export function formatDate(date: ISODate | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "MMM d, yyyy")
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "MMM d, yyyy h:mm a")
}

export function formatMonth(date: ISODate): string {
  return format(parseISO(date), "MMM yyyy")
}

export function formatMonthLong(date: ISODate): string {
  return format(parseISO(date), "MMMM yyyy")
}

export function formatRelative(date: string): string {
  return `${formatDistanceToNowStrict(parseISO(date))} ago`
}

/**
 * Format a payroll period: `Sep 1 to 15, 2026`, `Sep 26 to Oct 10, 2026`, or
 * `Dec 16, 2025 to Jan 15, 2026`.
 */
export function formatPeriod(start: ISODate, end: ISODate): string {
  const s = parseISO(start)
  const e = parseISO(end)
  if (s.getFullYear() !== e.getFullYear()) {
    return `${format(s, "MMM d, yyyy")} to ${format(e, "MMM d, yyyy")}`
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${format(s, "MMM d")} to ${format(e, "MMM d, yyyy")}`
  }
  return `${format(s, "MMM d")} to ${format(e, "d, yyyy")}`
}

/** Short period label for chart axes, for example `Sep 26`. */
export function formatPeriodShort(start: ISODate): string {
  const s = parseISO(start)
  return format(s, "MMM yy")
}

export function formatPercent(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits).replace(/\.?0+$/, "")}%`
}

export function formatHours(hours: number): string {
  return hours === 0 ? "0" : hours.toFixed(hours % 1 === 0 ? 0 : 1)
}

export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function fullName(p: {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
}): string {
  const mi = p.middleName ? ` ${p.middleName.charAt(0)}.` : ""
  const suffix = p.suffix ? ` ${p.suffix}` : ""
  return `${p.firstName}${mi} ${p.lastName}${suffix}`
}

/** Payroll register style: `DELA CRUZ, Juan P.` */
export function registerName(p: {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
}): string {
  const mi = p.middleName ? ` ${p.middleName.charAt(0)}.` : ""
  const suffix = p.suffix ? ` ${p.suffix}` : ""
  return `${p.lastName.toUpperCase()}, ${p.firstName}${suffix}${mi}`
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .filter((part) => /^[A-Z]/.test(part) && !part.endsWith("."))
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
}
