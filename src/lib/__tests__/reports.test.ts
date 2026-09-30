import { describe, expect, it } from "vitest"

import type { LeaveCredit, PayrollLine, PayrollRun } from "@/types"
import { pesos } from "@/lib/payroll/money"
import { EMPTY_TOTALS } from "@/lib/payroll/totals"
import {
  BONUS_EXEMPTION_CEILING,
  buildAlphalist,
  buildDepartmentSummary,
  buildForm2316,
  buildGeneralPayroll,
  buildLeaveMonetization,
  buildRegister,
  classifyLine,
  monetizableDays,
  reportableRuns,
  runMonths,
  summarizeTax,
} from "@/lib/reports"

import { allowanceTypes, makeEmployee, makeJobOrder, rates, schedule } from "../payroll/__tests__/fixtures"

function line(overrides: Partial<PayrollLine> = {}): PayrollLine {
  const base: PayrollLine = {
    employeeId: "emp-1",
    employeeNo: "2015-0001",
    employeeName: "SANTOS, Maria R.",
    departmentId: "dept-nursing",
    positionTitle: "Nurse II",
    group: "plantilla",
    monthlyRate: pesos(40_000),
    basicScheduled: pesos(20_000),
    tardinessUndertime: 0,
    absences: 0,
    basic: pesos(20_000),
    pera: pesos(1_000),
    allowances: [{ code: "RA", label: "Representation Allowance", amount: pesos(500) }],
    allowancesTotal: pesos(500),
    overtime: pesos(300),
    nightDiff: 0,
    otherEarnings: [],
    gross: pesos(21_800),
    taxableIncome: 0,
    gsis: pesos(1_800),
    gsisGovernment: pesos(2_400),
    ecc: pesos(50),
    philhealth: pesos(500),
    philhealthGovernment: pesos(500),
    pagibig: pesos(100),
    pagibigGovernment: pesos(100),
    withholdingTax: pesos(1_200),
    loans: [],
    loansTotal: pesos(700),
    otherDeductions: [],
    otherDeductionsTotal: 0,
    totalDeductions: pesos(4_300),
    net: pesos(17_500),
    flags: [],
    notes: [],
  }
  return { ...base, ...overrides }
}

function run(overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: "run-1",
    code: "REG-2026-09A-PL",
    type: "regular",
    title: "Regular Payroll, Plantilla",
    group: "plantilla",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-15",
    payDate: "2026-09-15",
    status: "released",
    employeeIds: ["emp-1"],
    lines: [line()],
    adjustments: [],
    comments: [],
    history: [],
    totals: EMPTY_TOTALS,
    createdBy: "test",
    createdAt: "2026-09-10T00:00:00.000Z",
    locked: true,
    ...overrides,
  }
}

const departments = [{ id: "dept-nursing", code: "NUR", name: "Nursing", costCenter: "CC-200", head: "Head" }]

describe("run helpers", () => {
  it("excludes drafts and sorts newest first", () => {
    const runs = [
      run({ id: "a", payDate: "2026-08-31" }),
      run({ id: "b", payDate: "2026-09-15" }),
      run({ id: "c", status: "draft", payDate: "2026-09-30" }),
      run({ id: "d", type: "special", payDate: "2026-09-10" }),
    ]
    expect(reportableRuns(runs).map((r) => r.id)).toEqual(["b", "d", "a"])
    expect(reportableRuns(runs, { regularOnly: true }).map((r) => r.id)).toEqual(["b", "a"])
    expect(runMonths(runs)).toEqual(["2026-09", "2026-08"])
  })
})

describe("general payroll and register", () => {
  it("reconciles allowances so earnings add up to gross", () => {
    const [row] = buildGeneralPayroll(run(), [makeEmployee()])
    expect(row?.rate).toBe("SG 16-1")
    expect(row!.basic + row!.pera + row!.allowances).toBe(row!.gross)
  })

  it("adds employer shares to gross for PS cost", () => {
    const [row] = buildRegister(run(), departments)
    expect(row?.employerShares).toBe(pesos(3_050))
    expect(row?.psCost).toBe(pesos(21_800) + pesos(3_050))
    expect(row?.department).toBe("Nursing")
  })
})

describe("summary by department", () => {
  it("counts unique heads across runs in the month and filters by group", () => {
    const runs = [
      run(),
      run({ id: "run-2", payDate: "2026-09-30", lines: [line(), line({ employeeId: "emp-jo", group: "jo_cos" })] }),
      run({ id: "run-3", payDate: "2026-08-31" }),
    ]
    const all = buildDepartmentSummary(runs, departments, "2026-09", "all")
    expect(all).toHaveLength(1)
    expect(all[0]?.headcount).toBe(2)
    expect(all[0]?.net).toBe(pesos(17_500) * 3)
    const plantilla = buildDepartmentSummary(runs, departments, "2026-09", "plantilla")
    expect(plantilla[0]?.headcount).toBe(1)
  })
})

describe("tax classification", () => {
  it("separates non-taxable allowances, de minimis, and bonuses", () => {
    const b = classifyLine(
      line({
        allowances: [
          { code: "RA", label: "RA", amount: pesos(500) },
          { code: "LP", label: "Longevity", amount: pesos(400) },
          { code: "MYB", label: "Mid-Year Bonus", amount: pesos(40_000) },
          { code: "SA", label: "Subsistence", amount: pesos(1_100) },
        ],
      }),
      allowanceTypes
    )
    expect(b.nonTaxableAllowances).toBe(pesos(500))
    expect(b.taxableAllowances).toBe(pesos(400))
    expect(b.bonuses).toBe(pesos(40_000))
    expect(b.deMinimis).toBe(pesos(1_100))
    expect(b.contributions).toBe(pesos(2_400))
  })

  it("caps exempt bonuses at the ceiling", () => {
    const b = { ...classifyLine(line({ allowances: [], allowancesTotal: 0 }), allowanceTypes), bonuses: pesos(100_000) }
    const s = summarizeTax(b)
    expect(s.exemptBonuses).toBe(BONUS_EXEMPTION_CEILING)
    expect(s.taxableBonuses).toBe(pesos(10_000))
  })
})

describe("BIR 2316", () => {
  it("annualizes regular taxable pay over 12 months", () => {
    const runs = [run({ id: "r1", payDate: "2026-01-31" }), run({ id: "r2", payDate: "2026-02-28" })]
    const form = buildForm2316({
      employee: makeEmployee(),
      runs,
      allowanceTypes,
      ratesVersions: [rates],
      year: "2026",
      asOf: "2026-09-30",
    })
    expect(form.monthsPaid).toBe(2)
    expect(form.monthly).toHaveLength(2)
    // Two monthly payrolls paid, projected to twelve
    expect(form.projectedAnnualTaxable).toBe(form.tax.taxable * 6)
    expect(form.taxWithheld).toBe(pesos(2_400))
    expect(form.tax.nonTaxable + form.tax.taxable).toBe(form.breakdown.gross)
  })
})

describe("alphalist", () => {
  it("lists employees with compensation in the year", () => {
    const rows = buildAlphalist({
      employees: [makeEmployee(), makeJobOrder()],
      runs: [run(), run({ id: "old", payDate: "2025-12-31" })],
      allowanceTypes,
      year: "2026",
      asOf: "2026-09-30",
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gross).toBe(pesos(21_800))
    expect(rows[0]!.nonTaxable + rows[0]!.taxable).toBe(rows[0]!.gross)
  })
})

describe("leave monetization", () => {
  it("monetizes up to 10 days beyond a 5-day retained balance", () => {
    expect(monetizableDays(3)).toBe(0)
    expect(monetizableDays(12.75)).toBe(7)
    expect(monetizableDays(40)).toBe(10)
  })

  it("computes the amount from the daily rate", () => {
    const credits: LeaveCredit[] = [
      { employeeId: "emp-1", vacationLeave: 20, sickLeave: 30, specialPrivilegeLeave: 0, forcedLeave: 0, asOf: "2026-08-31" },
    ]
    const [row] = buildLeaveMonetization({
      employees: [makeEmployee(), makeJobOrder()],
      leaveCredits: credits,
      salarySchedules: [schedule],
      ratesVersions: [rates],
      date: "2026-09-22",
      nameOf: (e) => e.lastName,
    })
    // SG 16 step 1 = 40,000 in the test schedule; 22 working days per month.
    expect(row?.monthlyRate).toBe(pesos(40_000))
    expect(row?.days).toBe(10)
    expect(row?.amount).toBe(Math.round((pesos(40_000) * 10) / 22))
  })
})
