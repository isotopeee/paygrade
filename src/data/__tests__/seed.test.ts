import { describe, expect, it } from "vitest"

import { groupOf } from "@/lib/constants"

import { createSeed } from "../seed"

describe("seed data", () => {
  const data = createSeed()

  it("is deterministic", () => {
    const again = createSeed()
    expect(again.employees.map((e) => e.lastName)).toEqual(data.employees.map((e) => e.lastName))
    expect(again.runs.map((r) => r.totals.net)).toEqual(data.runs.map((r) => r.totals.net))
  })

  it("has about 80 employees split roughly 60/40", () => {
    expect(data.employees).toHaveLength(80)
    const plantilla = data.employees.filter((e) => groupOf(e.employmentType) === "plantilla").length
    expect(plantilla / data.employees.length).toBeGreaterThan(0.55)
    expect(plantilla / data.employees.length).toBeLessThan(0.66)
  })

  it("has 12 months of history and one current draft", () => {
    const drafts = data.runs.filter((r) => r.status === "draft")
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.periodStart).toBe("2026-09-01")
    const regular = data.runs.filter((r) => r.type === "regular")
    // 11 released months for both groups plus the September Plantilla draft
    expect(regular.length).toBe(23)
  })

  it("keeps run totals consistent with lines", () => {
    for (const run of data.runs) {
      if (run.status === "draft") continue
      const net = run.lines.reduce((s, l) => s + l.net, 0)
      expect(run.totals.net).toBe(net)
      for (const l of run.lines) {
        expect(l.net).toBe(l.gross - l.totalDeductions)
        expect(Number.isInteger(l.net)).toBe(true)
      }
    }
  })

  it("has unique employee numbers", () => {
    const nos = new Set(data.employees.map((e) => e.employeeNo))
    expect(nos.size).toBe(data.employees.length)
  })
})
