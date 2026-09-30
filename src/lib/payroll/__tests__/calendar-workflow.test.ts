import { describe, expect, it } from "vitest"

import { canAdjust, canAdvance, canReturn, currentOwner, isLocked, nextStatus, returnTargets } from "@/lib/workflow"
import { formatPeriod } from "@/lib/format"

import { buildPeriod, buildPeriods, workingDaysBetween } from "../calendar"

describe("calendar", () => {
  it("counts working days excluding weekends and holidays", () => {
    expect(workingDaysBetween("2026-09-01", "2026-09-15")).toBe(11)
    // Aug 16 to 31, 2026 includes Aug 21 and Aug 31 holidays
    expect(workingDaysBetween("2026-08-16", "2026-08-31")).toBe(9)
    expect(workingDaysBetween("2026-09-15", "2026-09-01")).toBe(0)
  })

  it("builds monthly periods", () => {
    expect(buildPeriod("2026-09-16")).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-30",
      id: "P202609",
      workingDays: 22,
      payDate: "2026-09-30",
    })
    expect(buildPeriod("2026-02-01").end).toBe("2026-02-28")
    // August 2026 has two holidays (Aug 21 and Aug 31)
    expect(buildPeriod("2026-08-01").workingDays).toBe(19)
    const periods = buildPeriods("2025-10-01", "2026-09-01")
    expect(periods).toHaveLength(12)
    expect(periods[0]?.id).toBe("P202510")
    expect(periods.at(-1)?.end).toBe("2026-09-30")
  })

  it("formats periods", () => {
    expect(formatPeriod("2026-09-01", "2026-09-30")).toBe("Sep 1 to 30, 2026")
    expect(formatPeriod("2026-09-26", "2026-10-10")).toBe("Sep 26 to Oct 10, 2026")
    expect(formatPeriod("2025-12-16", "2026-01-15")).toBe("Dec 16, 2025 to Jan 15, 2026")
  })
})

describe("workflow", () => {
  it("moves forward one stage at a time with the right owner", () => {
    expect(nextStatus("draft")).toBe("computed")
    expect(nextStatus("released")).toBeNull()
    expect(currentOwner("draft")).toBe("hr")
    expect(currentOwner("computed")).toBe("hr")
    expect(currentOwner("reviewed")).toBe("accountant")
    expect(currentOwner("certified")).toBe("chief")
    expect(currentOwner("approved")).toBe("cashier")
    expect(currentOwner("released")).toBeNull()
    expect(canAdvance({ status: "reviewed" }, "accountant")).toBe(true)
    expect(canAdvance({ status: "reviewed" }, "hr")).toBe(false)
  })

  it("locks after approval and allows returns only before that", () => {
    expect(isLocked("certified")).toBe(false)
    expect(isLocked("approved")).toBe(true)
    expect(returnTargets("certified")).toEqual(["computed", "reviewed"])
    expect(returnTargets("computed")).toEqual([])
    expect(returnTargets("approved")).toEqual([])
    expect(canReturn({ status: "certified" }, "chief")).toBe(true)
    expect(canReturn({ status: "certified" }, "accountant")).toBe(false)
  })

  it("allows adjustments only on computed runs by HR", () => {
    expect(canAdjust({ status: "computed", locked: false }, "hr")).toBe(true)
    expect(canAdjust({ status: "reviewed", locked: false }, "hr")).toBe(false)
    expect(canAdjust({ status: "computed", locked: false }, "accountant")).toBe(false)
  })
})
