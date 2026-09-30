import {
  differenceInCalendarMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
} from "date-fns"

import type { ISODate, PayrollPeriod } from "@/types"

/**
 * Regular and special non-working holidays used to count working days.
 * Seed values for prototype only. Verify against the Proclamation issued for
 * each year.
 */
export const HOLIDAYS: Record<ISODate, string> = {
  "2025-01-01": "New Year's Day",
  "2025-01-29": "Chinese New Year",
  "2025-04-09": "Araw ng Kagitingan",
  "2025-04-17": "Maundy Thursday",
  "2025-04-18": "Good Friday",
  "2025-05-01": "Labor Day",
  "2025-06-12": "Independence Day",
  "2025-08-21": "Ninoy Aquino Day",
  "2025-08-25": "National Heroes Day",
  "2025-10-31": "All Saints' Day Eve",
  "2025-11-01": "All Saints' Day",
  "2025-12-08": "Feast of the Immaculate Conception",
  "2025-12-24": "Christmas Eve",
  "2025-12-25": "Christmas Day",
  "2025-12-30": "Rizal Day",
  "2025-12-31": "Last Day of the Year",
  "2026-01-01": "New Year's Day",
  "2026-02-17": "Chinese New Year",
  "2026-04-02": "Maundy Thursday",
  "2026-04-03": "Good Friday",
  "2026-04-09": "Araw ng Kagitingan",
  "2026-05-01": "Labor Day",
  "2026-06-12": "Independence Day",
  "2026-08-21": "Ninoy Aquino Day",
  "2026-08-31": "National Heroes Day",
  "2026-11-02": "All Souls' Day",
  "2026-11-30": "Bonifacio Day",
  "2026-12-08": "Feast of the Immaculate Conception",
  "2026-12-24": "Christmas Eve",
  "2026-12-25": "Christmas Day",
  "2026-12-30": "Rizal Day",
  "2026-12-31": "Last Day of the Year",
}

export function toISODate(date: Date): ISODate {
  return format(date, "yyyy-MM-dd")
}

export function isHoliday(date: ISODate): boolean {
  return date in HOLIDAYS
}

export function isWorkingDay(date: ISODate): boolean {
  return !isWeekend(parseISO(date)) && !isHoliday(date)
}

/** Count working days (Mon to Fri, excluding holidays) between two dates, inclusive. */
export function workingDaysBetween(start: ISODate, end: ISODate): number {
  if (end < start) return 0
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).filter((d) =>
    isWorkingDay(toISODate(d))
  ).length
}

export function workingDaysInRange(start: ISODate, end: ISODate): ISODate[] {
  if (end < start) return []
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })
    .map(toISODate)
    .filter(isWorkingDay)
}

/** Period id for the month containing `date`, for example `P202609`. */
export function periodId(date: ISODate): string {
  return `P${date.slice(0, 7).replace("-", "")}`
}

/** Build the monthly payroll period (1st to the last day of the month) containing `date`. */
export function buildPeriod(date: ISODate): PayrollPeriod {
  const start = `${date.slice(0, 7)}-01`
  const end = toISODate(endOfMonth(parseISO(start)))
  return {
    id: periodId(start),
    start,
    end,
    workingDays: workingDaysBetween(start, end),
    payDate: end,
  }
}

/** Monthly periods from `fromMonth` through `toMonth`, inclusive. */
export function buildPeriods(fromMonth: ISODate, toMonth: ISODate): PayrollPeriod[] {
  const from = parseISO(fromMonth)
  const months = differenceInCalendarMonths(parseISO(toMonth), from)
  const periods: PayrollPeriod[] = []
  for (let i = 0; i <= months; i++) {
    periods.push(buildPeriod(toISODate(new Date(from.getFullYear(), from.getMonth() + i, 1))))
  }
  return periods
}

/** Days from `a` to `b` in whole years, used for longevity and bonus eligibility. */
export function yearsBetween(a: ISODate, b: ISODate): number {
  return Math.floor(differenceInCalendarMonths(parseISO(b), parseISO(a)) / 12)
}

export function monthsBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarMonths(parseISO(b), parseISO(a))
}
