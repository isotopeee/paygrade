import { describe, expect, it } from "vitest"

import { amortizationSchedule, loanEndDate, loanTerms } from "@/lib/loans"

describe("amortizationSchedule", () => {
  const base = {
    startPeriod: "2026-07-01",
    termMonths: 6,
    monthlyAmortization: 100_001,
    totalPayable: 600_000,
    status: "active" as const,
  }

  it("builds one row per month and adds up to the total payable", () => {
    const rows = amortizationSchedule(base, "2026-09-01")
    expect(rows).toHaveLength(6)
    expect(rows[0]?.month).toBe("2026-07-01")
    expect(rows[5]?.month).toBe("2026-12-01")
    expect(rows[5]?.cumulativePaid).toBe(600_000)
    expect(rows[5]?.balance).toBe(0)
    // Last month takes the remainder
    expect(rows[5]?.amortization).toBe(600_000 - 100_001 * 5)
    expect(rows[0]?.amortization).toBe(100_001)
  })

  it("marks deducted, current, and scheduled months relative to the current month", () => {
    const statuses = amortizationSchedule(base, "2026-09-22").map((r) => r.status)
    expect(statuses).toEqual(["deducted", "deducted", "current", "scheduled", "scheduled", "scheduled"])
  })

  it("shows suspended from the current month for suspended loans", () => {
    const statuses = amortizationSchedule({ ...base, status: "suspended" }, "2026-09-01").map((r) => r.status)
    expect(statuses).toEqual(["deducted", "deducted", "suspended", "suspended", "suspended", "suspended"])
  })
})

describe("loanTerms", () => {
  it("computes add-on interest, total payable, and monthly amortization", () => {
    // PHP 100,000 at 12% per annum for 24 months: interest PHP 24,000
    const terms = loanTerms(10_000_000, 24, 12)
    expect(terms.interest).toBe(2_400_000)
    expect(terms.totalPayable).toBe(12_400_000)
    expect(terms.monthlyAmortization).toBe(516_667)
  })

  it("computes the end date as the last day of the final month", () => {
    expect(loanEndDate("2026-10-01", 12)).toBe("2027-09-30")
    expect(loanEndDate("2026-01-15", 2)).toBe("2026-02-28")
  })
})
