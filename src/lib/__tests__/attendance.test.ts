import { describe, expect, it } from "vitest"

import type { DtrSummary } from "@/types"
import { createSeed, CURRENT_PERIOD_ID } from "@/data/seed"
import { dtrKey } from "@/lib/payroll/engine"

import { buildDailyEntries, generateSampleDtrCsv, parseCsv, totalsOf, validateDtrCsv } from "../attendance"

const seed = createSeed()
const period = seed.periods.find((p) => p.id === CURRENT_PERIOD_ID)!
const existingKeys = new Set(seed.dtr.map((d) => dtrKey(d.periodId, d.employeeId)))

describe("parseCsv", () => {
  it("handles quotes, CRLF, BOM, and blank lines", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","say ""hi""",3\r\n\r\n1,2,3\n')
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "3"],
      ["1", "2", "3"],
    ])
  })
})

describe("buildDailyEntries", () => {
  it("is deterministic and matches summary totals for every seeded record in every period", () => {
    const employees = new Map(seed.employees.map((e) => [e.id, e]))
    const periods = new Map(seed.periods.map((p) => [p.id, p]))
    expect(seed.dtr.length).toBeGreaterThan(100)
    for (const summary of seed.dtr) {
      const employee = employees.get(summary.employeeId)!
      const p = periods.get(summary.periodId)!
      const entries = buildDailyEntries(employee, p, summary)
      expect(entries).toEqual(buildDailyEntries(employee, p, summary))
      const totals = totalsOf(entries)
      expect(totals.lateMinutes).toBe(summary.tardinessMinutes)
      expect(totals.undertimeMinutes).toBe(summary.undertimeMinutes)
      expect(totals.overtimeHours).toBe(summary.overtimeHoursRegular + summary.overtimeHoursRestDay)
      expect(totals.nightDiffHours).toBe(summary.nightDiffHours)
      expect(entries.filter((e) => e.kind === "absent")).toHaveLength(summary.absencesWithoutPay)
      expect(entries.filter((e) => e.kind === "leave")).toHaveLength(Math.floor(summary.leaveWithPayDays))
    }
  })

  it("marks holidays, weekends, and days outside service", () => {
    const employee = { id: "x", dateHired: "2026-09-20", separationDate: undefined }
    const aug = seed.periods.find((p) => p.id === "P202608")!
    const summary: DtrSummary = {
      employeeId: "x",
      periodId: aug.id,
      daysRequired: 0,
      daysWorked: 0,
      leaveWithPayDays: 0,
      absencesWithoutPay: 0,
      tardinessMinutes: 0,
      undertimeMinutes: 0,
      overtimeHoursRegular: 0,
      overtimeHoursRestDay: 0,
      nightDiffHours: 0,
      source: "manual",
    }
    expect(buildDailyEntries(employee, aug, summary).every((e) => e.kind === "not_employed")).toBe(true)
    const entries = buildDailyEntries({ ...employee, dateHired: "2020-01-01" }, aug, summary)
    expect(entries.find((e) => e.date === "2026-08-21")).toMatchObject({ kind: "holiday", remarks: "Ninoy Aquino Day" })
    expect(entries.find((e) => e.date === "2026-08-22")?.kind).toBe("weekend")
  })
})

describe("CSV import", () => {
  it("sample file has valid rows and exactly three invalid rows", () => {
    const csv = generateSampleDtrCsv({ employees: seed.employees, period, existingKeys })
    const result = validateDtrCsv(csv, { employees: seed.employees, period, existingKeys })
    expect(result.fileErrors).toEqual([])
    expect(result.invalidCount).toBe(3)
    expect(result.createCount).toBeGreaterThan(0)
    expect(result.overwriteCount).toBe(4)
    for (const row of result.rows.filter((r) => r.record)) {
      expect(row.record!.source).toBe("import")
    }
  })

  it("reports missing columns", () => {
    const result = validateDtrCsv("employee_no,period_start\n2020-0001,2026-09-16", {
      employees: seed.employees,
      period,
      existingKeys,
    })
    expect(result.fileErrors[0]).toMatch(/Missing columns/)
  })
})
