/**
 * Time and attendance helpers: daily time record (CS Form No. 48) builder,
 * biometric CSV parsing and validation, and a sample CSV generator.
 *
 * Everything here is pure and deterministic so the same employee and period
 * always render the same daily entries.
 */

import { eachDayOfInterval, format, parseISO } from "date-fns"

import type { DtrDailyEntry, DtrSummary, Employee, PayrollPeriod } from "@/types"
import { HOLIDAYS, isWorkingDay, toISODate } from "@/lib/payroll/calendar"
import { daysRequiredInPeriod } from "@/lib/payroll/compute"
import { dtrKey, employeesForPeriod } from "@/lib/payroll/engine"

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit hash of a string. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Mulberry32 PRNG. Returns a function producing floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rngFor(key: string): () => number {
  return createRng(hashString(key))
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}

/** Split an integer total into `parts` positive integers (or fewer if total is small). */
function splitInteger(total: number, parts: number, rng: () => number): number[] {
  if (total <= 0 || parts <= 0) return []
  const n = Math.min(parts, total)
  const weights = Array.from({ length: n }, () => 0.5 + rng())
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const result = weights.map((w) => Math.max(1, Math.floor((w / weightSum) * total)))
  let diff = total - result.reduce((a, b) => a + b, 0)
  let i = 0
  while (diff !== 0) {
    const idx = i % n
    if (diff > 0) {
      result[idx] = (result[idx] ?? 0) + 1
      diff -= 1
    } else if ((result[idx] ?? 0) > 1) {
      result[idx] = (result[idx] ?? 0) - 1
      diff += 1
    }
    i += 1
  }
  return result
}

/** Split hours into chunks of at most `chunk` hours (last chunk takes the remainder). */
function splitHours(total: number, chunk: number): number[] {
  const result: number[] = []
  let left = Math.round(total * 100) / 100
  while (left > 0) {
    const part = Math.min(chunk, left)
    result.push(part)
    left = Math.round((left - part) * 100) / 100
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Time formatting                                                     */
/* ------------------------------------------------------------------ */

/** Format minutes after midnight as `7:52 AM`. Wraps past midnight. */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h24 = Math.floor(m / 60)
  const min = m % 60
  const suffix = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(min).padStart(2, "0")} ${suffix}`
}

const H = 60

/* ------------------------------------------------------------------ */
/* Daily time record                                                   */
/* ------------------------------------------------------------------ */

interface DayPlan {
  late: number
  undertime: number
  ot: number
  nd: number
  halfDay: boolean
}

/**
 * Build the daily entries of a Daily Time Record for a period, consistent with
 * the period summary: absences and leave land on specific working days,
 * tardiness, undertime, overtime and night differential are distributed across
 * worked days so that the column totals match the summary.
 */
export function buildDailyEntries(
  employee: Pick<Employee, "id" | "dateHired" | "separationDate">,
  period: Pick<PayrollPeriod, "id" | "start" | "end">,
  summary: DtrSummary | undefined
): DtrDailyEntry[] {
  const dates = eachDayOfInterval({ start: parseISO(period.start), end: parseISO(period.end) }).map(toISODate)
  const employed = (d: string) =>
    d >= employee.dateHired && (!employee.separationDate || d <= employee.separationDate)

  const workdays = dates.filter((d) => employed(d) && isWorkingDay(d))
  const placement = rngFor(`${employee.id}:${period.id}:placement`)

  // Leave as one consecutive block, absences scattered across the rest.
  const leaveDays = new Set<string>()
  const absentDays = new Set<string>()
  const plans = new Map<string, DayPlan>()
  let restDayOt: { date: string; hours: number }[] = []

  if (summary) {
    const leaveTotal = Math.max(0, summary.leaveWithPayDays)
    const absenceTotal = Math.max(0, summary.absencesWithoutPay)
    const leaveWhole = Math.min(Math.floor(leaveTotal), workdays.length)
    const leaveHalf = leaveTotal - Math.floor(leaveTotal) > 0

    if (leaveWhole > 0) {
      const startIdx = randInt(placement, 0, workdays.length - leaveWhole)
      for (let i = 0; i < leaveWhole; i++) leaveDays.add(workdays[startIdx + i] as string)
    }
    const afterLeave = shuffle(
      workdays.filter((d) => !leaveDays.has(d)),
      placement
    )
    const absenceWhole = Math.min(Math.floor(absenceTotal), afterLeave.length)
    afterLeave.slice(0, absenceWhole).forEach((d) => absentDays.add(d))

    const worked = workdays.filter((d) => !leaveDays.has(d) && !absentDays.has(d))
    for (const d of worked) plans.set(d, { late: 0, undertime: 0, ot: 0, nd: 0, halfDay: false })

    if (leaveHalf && worked.length > 0) {
      const d = worked[randInt(placement, 0, worked.length - 1)] as string
      const plan = plans.get(d)
      if (plan) plan.halfDay = true
    }

    const fullDays = worked.filter((d) => !plans.get(d)?.halfDay)
    const pool = fullDays.length > 0 ? fullDays : worked

    // Night shifts first, so late and undertime can be applied to any day.
    const ndChunks = splitHours(Math.max(0, summary.nightDiffHours), 8)
    const ndDays = shuffle(pool, placement).slice(0, ndChunks.length)
    ndDays.forEach((d, i) => {
      const plan = plans.get(d)
      if (plan) plan.nd = ndChunks[i] ?? 0
    })
    // Any chunks beyond the available days pile onto the last night.
    if (ndChunks.length > ndDays.length && ndDays.length > 0) {
      const last = plans.get(ndDays[ndDays.length - 1] as string)
      if (last) last.nd += ndChunks.slice(ndDays.length).reduce((a, b) => a + b, 0)
    }

    const lateTotal = Math.max(0, Math.round(summary.tardinessMinutes))
    const lateParts = splitInteger(lateTotal, Math.min(pool.length, Math.max(1, Math.ceil(lateTotal / 18))), placement)
    shuffle(pool, placement)
      .slice(0, lateParts.length)
      .forEach((d, i) => {
        const plan = plans.get(d)
        if (plan) plan.late = lateParts[i] ?? 0
      })

    const underTotal = Math.max(0, Math.round(summary.undertimeMinutes))
    const underParts = splitInteger(underTotal, Math.min(pool.length, Math.max(1, Math.ceil(underTotal / 30))), placement)
    const dayShiftPool = pool.filter((d) => (plans.get(d)?.nd ?? 0) === 0)
    const underPool = dayShiftPool.length >= underParts.length ? dayShiftPool : pool
    shuffle(underPool, placement)
      .slice(0, underParts.length)
      .forEach((d, i) => {
        const plan = plans.get(d)
        if (plan) plan.undertime = underParts[i] ?? 0
      })

    const otChunks = splitHours(Math.max(0, summary.overtimeHoursRegular), 4)
    const otPool = pool.filter((d) => (plans.get(d)?.undertime ?? 0) === 0 && (plans.get(d)?.nd ?? 0) === 0)
    const otCandidates = shuffle(otPool.length >= otChunks.length ? otPool : pool, placement)
    otChunks.forEach((hours, i) => {
      const d = otCandidates[i % Math.max(1, otCandidates.length)]
      const plan = d ? plans.get(d) : undefined
      if (plan) plan.ot += hours
    })

    // Rest day overtime on a Saturday (Sunday if no Saturday, split if over 8 hours).
    const restHours = Math.max(0, summary.overtimeHoursRestDay)
    if (restHours > 0) {
      const weekends = dates.filter((d) => employed(d) && !(d in HOLIDAYS) && !isWorkingDay(d))
      const saturdays = weekends.filter((d) => parseISO(d).getDay() === 6)
      const ordered = [...saturdays, ...weekends.filter((d) => parseISO(d).getDay() !== 6)]
      const chunks = splitHours(restHours, 8)
      if (ordered.length > 0) {
        restDayOt = chunks.map((hours, i) => ({ date: ordered[i % ordered.length] as string, hours }))
      } else {
        // No rest day in service: record the hours on the last worked day.
        const last = pool[pool.length - 1]
        const plan = last ? plans.get(last) : undefined
        if (plan) plan.ot += restHours
      }
    }
  }

  const restDayMap = new Map<string, number>()
  for (const r of restDayOt) restDayMap.set(r.date, (restDayMap.get(r.date) ?? 0) + r.hours)

  return dates.map((date) => {
    const weekday = format(parseISO(date), "EEE")
    const base: DtrDailyEntry = {
      date,
      weekday,
      kind: "workday",
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeHours: 0,
      nightDiffHours: 0,
    }
    const jitter = rngFor(`${employee.id}:${date}`)

    if (!employed(date)) return { ...base, kind: "not_employed", remarks: "Not employed" }

    const holiday = HOLIDAYS[date]
    const restOt = restDayMap.get(date)
    if (holiday || !isWorkingDay(date)) {
      const kind = holiday ? "holiday" : "weekend"
      const remarks = holiday ?? "Rest day"
      if (restOt) {
        const inAt = 8 * H - randInt(jitter, 0, 10)
        const span = restOt * H
        const morning = Math.min(span, 4 * H)
        const afternoon = span - morning
        return {
          ...base,
          kind,
          amIn: formatClock(inAt),
          amOut: formatClock(8 * H + morning),
          pmIn: afternoon > 0 ? formatClock(13 * H) : undefined,
          pmOut: afternoon > 0 ? formatClock(13 * H + afternoon) : undefined,
          overtimeHours: restOt,
          remarks: `${remarks}, overtime`,
        }
      }
      return { ...base, kind, remarks }
    }

    if (!summary) return { ...base, remarks: "No logs" }
    if (leaveDays.has(date)) return { ...base, kind: "leave", remarks: "Leave with pay" }
    if (absentDays.has(date)) return { ...base, kind: "absent", remarks: "Absent, leave without pay" }

    const plan = plans.get(date)
    if (!plan) return base

    if (plan.nd > 0) {
      // Night shift: 8 hours ending at 6:00 AM, shifted earlier for partial ND.
      const ndHours = plan.nd
      const shiftStart = 22 * H - Math.max(0, 8 - Math.min(ndHours, 8)) * H
      const shiftEnd = shiftStart + 8 * H + Math.max(0, ndHours - 8) * H
      const inAt = plan.late > 0 ? shiftStart + plan.late : shiftStart - randInt(jitter, 2, 15)
      const breakAt = shiftStart + 4 * H
      const outAt = shiftEnd - plan.undertime + plan.ot * H + (plan.undertime === 0 && plan.ot === 0 ? randInt(jitter, 0, 8) : 0)
      return {
        ...base,
        amIn: formatClock(inAt),
        amOut: formatClock(breakAt),
        pmIn: formatClock(breakAt),
        pmOut: formatClock(outAt),
        lateMinutes: plan.late,
        undertimeMinutes: plan.undertime,
        overtimeHours: plan.ot,
        nightDiffHours: ndHours,
        remarks: "Night shift",
      }
    }

    const inAt = plan.late > 0 ? 8 * H + plan.late : 8 * H - randInt(jitter, 3, 22)
    const amOut = 12 * H + randInt(jitter, 0, 4)
    const pmIn = 12 * H + 50 + randInt(jitter, 0, 9)
    if (plan.halfDay) {
      return {
        ...base,
        amIn: formatClock(inAt),
        amOut: formatClock(amOut),
        lateMinutes: plan.late,
        undertimeMinutes: plan.undertime,
        remarks: "Half day leave (PM)",
      }
    }
    const outAt =
      plan.undertime > 0
        ? 17 * H - plan.undertime
        : 17 * H + plan.ot * H + randInt(jitter, 0, plan.ot > 0 ? 5 : 12)
    const remarks = [plan.late > 0 ? "Late" : null, plan.undertime > 0 ? "Undertime" : null, plan.ot > 0 ? "Overtime" : null]
      .filter(Boolean)
      .join(", ")
    return {
      ...base,
      amIn: formatClock(inAt),
      amOut: formatClock(amOut),
      pmIn: formatClock(pmIn),
      pmOut: formatClock(outAt),
      lateMinutes: plan.late,
      undertimeMinutes: plan.undertime,
      overtimeHours: plan.ot,
      remarks: remarks || undefined,
    }
  })
}

export interface DailyTotals {
  lateMinutes: number
  undertimeMinutes: number
  overtimeHours: number
  nightDiffHours: number
}

export function totalsOf(entries: readonly DtrDailyEntry[]): DailyTotals {
  return entries.reduce<DailyTotals>(
    (acc, e) => ({
      lateMinutes: acc.lateMinutes + e.lateMinutes,
      undertimeMinutes: acc.undertimeMinutes + e.undertimeMinutes,
      overtimeHours: Math.round((acc.overtimeHours + e.overtimeHours) * 100) / 100,
      nightDiffHours: Math.round((acc.nightDiffHours + e.nightDiffHours) * 100) / 100,
    }),
    { lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, nightDiffHours: 0 }
  )
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export const DTR_CSV_COLUMNS = [
  "employee_no",
  "period_start",
  "period_end",
  "days_worked",
  "leave_with_pay",
  "absences",
  "tardiness_min",
  "undertime_min",
  "ot_regular_hours",
  "ot_restday_hours",
  "night_diff_hours",
] as const

export type DtrCsvColumn = (typeof DTR_CSV_COLUMNS)[number]

export const DTR_CSV_HEADER = DTR_CSV_COLUMNS.join(",")

/**
 * Parse CSV text into rows of fields. Handles quoted fields, escaped quotes,
 * commas and newlines inside quotes, CRLF line endings, a UTF-8 BOM, and
 * skips blank lines.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  const pushRow = () => {
    row.push(field)
    field = ""
    if (!(row.length === 1 && row[0]?.trim() === "")) rows.push(row)
    row = []
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n") pushRow()
    else if (ch === "\r") {
      if (input[i + 1] === "\n") i += 1
      pushRow()
    } else field += ch
  }
  if (field !== "" || row.length > 0) pushRow()
  return rows
}

function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((r) => r.map(csvField).join(",")).join("\n")
}

export interface DtrImportRow {
  /** 1-based line number in the file (header is line 1). */
  line: number
  employeeNo: string
  employee?: Employee
  values: Partial<Record<DtrCsvColumn, string>>
  errors: string[]
  /** Built record, present only when the row is valid. */
  record?: DtrSummary
  action: "create" | "overwrite"
}

export interface DtrImportResult {
  /** File-level problems (for example a missing column). No rows are valid when present. */
  fileErrors: string[]
  rows: DtrImportRow[]
  validCount: number
  invalidCount: number
  createCount: number
  overwriteCount: number
}

const DAY_FIELDS = ["days_worked", "leave_with_pay", "absences"] as const
const MINUTE_FIELDS = ["tardiness_min", "undertime_min"] as const
const HOUR_FIELDS = ["ot_regular_hours", "ot_restday_hours", "night_diff_hours"] as const

const FIELD_LABELS: Record<DtrCsvColumn, string> = {
  employee_no: "Employee no.",
  period_start: "Period start",
  period_end: "Period end",
  days_worked: "Days worked",
  leave_with_pay: "Leave with pay",
  absences: "Absences",
  tardiness_min: "Tardiness minutes",
  undertime_min: "Undertime minutes",
  ot_regular_hours: "Regular OT hours",
  ot_restday_hours: "Rest day OT hours",
  night_diff_hours: "Night differential hours",
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === "") return null
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return Number.NaN
  return Number(trimmed)
}

/**
 * Validate biometric CSV text against the selected period. Each row becomes a
 * DtrSummary with source "import" when valid.
 */
export function validateDtrCsv(
  text: string,
  ctx: {
    employees: readonly Employee[]
    period: PayrollPeriod
    existingKeys: ReadonlySet<string>
  }
): DtrImportResult {
  const empty: DtrImportResult = { fileErrors: [], rows: [], validCount: 0, invalidCount: 0, createCount: 0, overwriteCount: 0 }
  const table = parseCsv(text)
  if (table.length === 0) return { ...empty, fileErrors: ["The file is empty."] }

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase())
  const missing = DTR_CSV_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    return { ...empty, fileErrors: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`] }
  }
  if (table.length === 1) return { ...empty, fileErrors: ["The file has a header but no data rows."] }

  const byNo = new Map(ctx.employees.map((e) => [e.employeeNo.toLowerCase(), e]))
  const seen = new Set<string>()
  const rows: DtrImportRow[] = []

  table.slice(1).forEach((cells, index) => {
    const values: Partial<Record<DtrCsvColumn, string>> = {}
    DTR_CSV_COLUMNS.forEach((col) => {
      values[col] = (cells[header.indexOf(col)] ?? "").trim()
    })
    const errors: string[] = []
    const employeeNo = values.employee_no ?? ""
    const employee = employeeNo ? byNo.get(employeeNo.toLowerCase()) : undefined

    if (!employeeNo) errors.push("Employee no. is blank")
    else if (!employee) errors.push(`Unknown employee no. ${employeeNo}`)
    else if (employee.status === "suspended") errors.push("Employee is suspended")
    else if (employee.dateHired > ctx.period.end || (employee.separationDate && employee.separationDate < ctx.period.start))
      errors.push("Employee not in service during the period")

    if (employee) {
      if (seen.has(employee.id)) errors.push("Duplicate row for this employee")
      seen.add(employee.id)
    }

    if (values.period_start !== ctx.period.start || values.period_end !== ctx.period.end) {
      errors.push(`Period must be ${ctx.period.start} to ${ctx.period.end}`)
    }

    const nums = {} as Record<(typeof DAY_FIELDS)[number] | (typeof MINUTE_FIELDS)[number] | (typeof HOUR_FIELDS)[number], number>
    for (const col of [...DAY_FIELDS, ...MINUTE_FIELDS, ...HOUR_FIELDS]) {
      const n = parseNumber(values[col])
      if (n === null) {
        errors.push(`${FIELD_LABELS[col]} is blank`)
        nums[col] = 0
      } else if (Number.isNaN(n)) {
        errors.push(`${FIELD_LABELS[col]} is not a number`)
        nums[col] = 0
      } else if (n < 0) {
        errors.push(`${FIELD_LABELS[col]} cannot be negative`)
        nums[col] = 0
      } else {
        if ((MINUTE_FIELDS as readonly string[]).includes(col) && !Number.isInteger(n)) {
          errors.push(`${FIELD_LABELS[col]} must be whole minutes`)
        }
        if ((DAY_FIELDS as readonly string[]).includes(col) && (n * 2) % 1 !== 0) {
          errors.push(`${FIELD_LABELS[col]} must be in half days`)
        }
        nums[col] = n
      }
    }

    let daysRequired = 0
    if (employee) {
      daysRequired = daysRequiredInPeriod(employee, ctx.period)
      if (nums.days_worked > daysRequired) {
        errors.push(`Days worked (${nums.days_worked}) exceeds days required (${daysRequired})`)
      } else if (nums.days_worked + nums.leave_with_pay + nums.absences > daysRequired) {
        errors.push(`Days worked, leave, and absences exceed days required (${daysRequired})`)
      }
      if (nums.night_diff_hours > 24 * daysRequired) errors.push("Night differential hours exceed the period")
    }

    const action = employee && ctx.existingKeys.has(dtrKey(ctx.period.id, employee.id)) ? "overwrite" : "create"
    const record: DtrSummary | undefined =
      employee && errors.length === 0
        ? {
            employeeId: employee.id,
            periodId: ctx.period.id,
            daysRequired,
            daysWorked: nums.days_worked,
            leaveWithPayDays: nums.leave_with_pay,
            absencesWithoutPay: nums.absences,
            tardinessMinutes: nums.tardiness_min,
            undertimeMinutes: nums.undertime_min,
            overtimeHoursRegular: nums.ot_regular_hours,
            overtimeHoursRestDay: nums.ot_restday_hours,
            nightDiffHours: nums.night_diff_hours,
            source: "import",
          }
        : undefined

    rows.push({ line: index + 2, employeeNo, employee, values, errors, record, action })
  })

  const valid = rows.filter((r) => r.record)
  return {
    fileErrors: [],
    rows,
    validCount: valid.length,
    invalidCount: rows.length - valid.length,
    createCount: valid.filter((r) => r.action === "create").length,
    overwriteCount: valid.filter((r) => r.action === "overwrite").length,
  }
}

/* ------------------------------------------------------------------ */
/* Sample file                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a sample biometric export for a period: every in-service employee
 * without a DTR record, a few employees who already have one (to show
 * overwrites), and three intentionally invalid rows.
 */
export function generateSampleDtrCsv(ctx: {
  employees: readonly Employee[]
  period: PayrollPeriod
  existingKeys: ReadonlySet<string>
}): string {
  const { period } = ctx
  const rng = rngFor(`sample:${period.id}`)
  const inService = [
    ...employeesForPeriod(ctx.employees, "plantilla", period.start, period.end),
    ...employeesForPeriod(ctx.employees, "jo_cos", period.start, period.end),
  ].sort((a, b) => a.employeeNo.localeCompare(b.employeeNo))

  const missing = inService.filter((e) => !ctx.existingKeys.has(dtrKey(period.id, e.id)))
  const existing = inService.filter((e) => ctx.existingKeys.has(dtrKey(period.id, e.id)))
  const overwrite = shuffle(existing, rng).slice(0, 4)
  const invalidPool = shuffle(
    existing.filter((e) => !overwrite.includes(e)),
    rng
  )

  const row = (e: Employee, overrides: Partial<Record<DtrCsvColumn, string | number>> = {}) => {
    const required = daysRequiredInPeriod(e, period)
    const absences = rng() < 0.12 ? Math.min(1, required) : 0
    const leave = rng() < 0.2 ? Math.min(randInt(rng, 1, 2), required - absences) : 0
    const worked = required - absences - leave
    const late = rng() < 0.4 ? randInt(rng, 3, 60) : 0
    const under = rng() < 0.15 ? randInt(rng, 10, 45) : 0
    const ot = rng() < 0.3 ? [2, 4, 4, 6][randInt(rng, 0, 3)] ?? 0 : 0
    const otRest = rng() < 0.15 ? 8 : 0
    const nd = e.isHealthWorker && rng() < 0.3 ? Math.min(8 * randInt(rng, 1, 4), worked * 8) : 0
    const base: Record<DtrCsvColumn, string | number> = {
      employee_no: e.employeeNo,
      period_start: period.start,
      period_end: period.end,
      days_worked: worked,
      leave_with_pay: leave,
      absences,
      tardiness_min: late,
      undertime_min: under,
      ot_regular_hours: ot,
      ot_restday_hours: otRest,
      night_diff_hours: nd,
    }
    const merged = { ...base, ...overrides }
    return DTR_CSV_COLUMNS.map((c) => merged[c])
  }

  const rows: (string | number)[][] = [[...DTR_CSV_COLUMNS]]
  for (const e of missing) rows.push(row(e))
  for (const e of overwrite) rows.push(row(e))

  // Intentionally invalid rows.
  const template = invalidPool[0] ?? inService[0]
  if (template) {
    rows.push(row(template, { employee_no: "2099-9999" }))
  }
  const negative = invalidPool[1]
  if (negative) rows.push(row(negative, { tardiness_min: -15 }))
  const overDays = invalidPool[2]
  if (overDays) {
    const required = daysRequiredInPeriod(overDays, period)
    rows.push(row(overDays, { days_worked: required + 2, leave_with_pay: 0, absences: 0 }))
  }
  return toCsv(rows)
}
