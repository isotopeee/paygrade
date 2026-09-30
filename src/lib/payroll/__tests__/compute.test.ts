import { describe, expect, it } from "vitest"

import type { Adjustment, DtrSummary, Loan } from "@/types"

import {
  computeBasicPay,
  computeGross,
  computeGsis,
  computeHazardPay,
  computeJoCosWithholding,
  computeLoanDeductions,
  computeLongevityPay,
  computeNet,
  computeNightDiff,
  computeOvertime,
  computePagibig,
  computePayrollLine,
  computePera,
  computePhilhealth,
  computeSpecialLine,
  computeSubsistenceLaundry,
  computeWithholdingTax,
  daysRequiredInPeriod,
  hazardRateFor,
  isEligibleForSpecial,
  monthlyRateFor,
  rateBasis,
  salaryFor,
} from "../compute"
import { pesos } from "../money"
import { ratesForDate, SEED_RATES } from "../rates"
import {
  allowanceTypes,
  makeEmployee,
  makeJobOrder,
  periodSeptember,
  rates,
  schedule,
} from "./fixtures"

const monthlyBasis = (monthly: number) => ({ base: monthly, daysDivisor: 22, hoursPerDay: 8 })
const dailyBasis = (daily: number) => ({ base: daily, daysDivisor: 1, hoursPerDay: 8 })

function dtr(overrides: Partial<DtrSummary> = {}): DtrSummary {
  return {
    employeeId: "emp-1",
    periodId: periodSeptember.id,
    daysRequired: 22,
    daysWorked: 22,
    leaveWithPayDays: 0,
    absencesWithoutPay: 0,
    tardinessMinutes: 0,
    undertimeMinutes: 0,
    overtimeHoursRegular: 0,
    overtimeHoursRestDay: 0,
    nightDiffHours: 0,
    source: "biometric",
    ...overrides,
  }
}

describe("rate resolution", () => {
  it("reads the salary schedule by grade and step", () => {
    expect(salaryFor(schedule, 1, 1)).toBe(pesos(10_000))
    expect(salaryFor(schedule, 16, 2)).toBe(pesos(40_100))
    expect(() => salaryFor(schedule, 34, 1)).toThrow()
  })

  it("derives a monthly equivalent for daily and monthly contract rates", () => {
    expect(monthlyRateFor(makeEmployee(), schedule, rates)).toBe(pesos(40_000))
    expect(monthlyRateFor(makeJobOrder(), schedule, rates)).toBe(pesos(13_200))
    expect(
      monthlyRateFor(makeJobOrder({ rateType: "monthly", contractRate: pesos(25_000) }), schedule, rates)
    ).toBe(pesos(25_000))
  })

  it("picks the rates version in force on a date", () => {
    expect(ratesForDate(SEED_RATES, "2024-06-01").id).toBe("rates-2024")
    expect(ratesForDate(SEED_RATES, "2026-09-01").id).toBe("rates-2025")
    // Before the first version, fall back to the earliest one
    expect(ratesForDate(SEED_RATES, "2020-01-01").id).toBe("rates-2024")
  })

  it("counts days required for new hires and separations", () => {
    const e = makeEmployee({ dateHired: "2026-09-08" })
    expect(daysRequiredInPeriod(e, periodSeptember)).toBe(17)
    const s = makeEmployee({ separationDate: "2026-09-04" })
    expect(daysRequiredInPeriod(s, periodSeptember)).toBe(4)
    expect(daysRequiredInPeriod(makeEmployee(), periodSeptember)).toBe(22)
  })
})

describe("computeBasicPay", () => {
  const base = {
    group: "plantilla" as const,
    workingDays: 22,
    daysRequired: 22,
    absencesWithoutPay: 0,
    tardinessMinutes: 0,
    undertimeMinutes: 0,
  }

  it("pays the full monthly salary for a full plantilla month", () => {
    const r = computeBasicPay({ ...base, basis: monthlyBasis(pesos(30_000)), monthlyRate: pesos(30_000) })
    expect(r).toEqual({ scheduled: pesos(30_000), absences: 0, tardinessUndertime: 0, earned: pesos(30_000) })
  })

  it("keeps odd centavos of the monthly salary intact", () => {
    const monthly = 3000101
    expect(computeBasicPay({ ...base, basis: monthlyBasis(monthly), monthlyRate: monthly }).earned).toBe(monthly)
  })

  it("prorates a partial month for a new hire", () => {
    const r = computeBasicPay({
      ...base,
      daysRequired: 11,
      basis: monthlyBasis(pesos(44_000)),
      monthlyRate: pesos(44_000),
    })
    // 44,000 x 11 / 22
    expect(r.scheduled).toBe(pesos(22_000))
  })

  it("deducts absences without pay at the daily rate and tardiness per minute", () => {
    const r = computeBasicPay({
      ...base,
      absencesWithoutPay: 2,
      tardinessMinutes: 45,
      undertimeMinutes: 15,
      basis: monthlyBasis(pesos(22_000)),
      monthlyRate: pesos(22_000),
    })
    expect(r.absences).toBe(pesos(2_000))
    expect(r.tardinessUndertime).toBe(pesos(125)) // one hour at 22,000 / 22 / 8
    expect(r.earned).toBe(pesos(22_000 - 2_000 - 125))
  })

  it("never returns negative earned pay", () => {
    const r = computeBasicPay({
      ...base,
      absencesWithoutPay: 30,
      basis: monthlyBasis(pesos(22_000)),
      monthlyRate: pesos(22_000),
    })
    expect(r.earned).toBe(0)
  })

  it("computes JO pay as daily rate times days worked", () => {
    const r = computeBasicPay({
      ...base,
      group: "jo_cos",
      absencesWithoutPay: 1,
      tardinessMinutes: 30,
      basis: dailyBasis(pesos(600)),
      monthlyRate: pesos(13_200),
    })
    expect(r.scheduled).toBe(pesos(13_200))
    expect(r.absences).toBe(pesos(600))
    expect(r.tardinessUndertime).toBe(pesos("37.50"))
    expect(r.earned).toBe(pesos("12562.50"))
  })
})

describe("allowances and premiums", () => {
  it("pays PERA to plantilla only and prorates for partial periods", () => {
    const common = { workingDays: 22, absencesWithoutPay: 0, rates }
    expect(computePera({ ...common, group: "plantilla", daysRequired: 22 })).toBe(pesos(2_000))
    expect(computePera({ ...common, group: "plantilla", daysRequired: 12 })).toBe(pesos("1090.91"))
    expect(computePera({ ...common, group: "plantilla", daysRequired: 22, absencesWithoutPay: 22 })).toBe(0)
    expect(computePera({ ...common, group: "jo_cos", daysRequired: 22 })).toBe(0)
  })

  it("computes overtime at 125% on regular days and 150% on rest days", () => {
    const basis = monthlyBasis(pesos(22_000)) // hourly 125
    expect(computeOvertime({ basis, hoursRegular: 4, hoursRestDay: 0, rates })).toBe(pesos(625))
    expect(computeOvertime({ basis, hoursRegular: 0, hoursRestDay: 2, rates })).toBe(pesos(375))
    expect(computeOvertime({ basis, hoursRegular: 0, hoursRestDay: 0, rates })).toBe(0)
  })

  it("limits night differential to plantilla at or below the salary grade cap", () => {
    const basis = monthlyBasis(pesos(22_000))
    expect(computeNightDiff({ basis, hours: 10, group: "plantilla", salaryGrade: 15, rates })).toBe(pesos(250))
    expect(computeNightDiff({ basis, hours: 10, group: "plantilla", salaryGrade: 22, rates })).toBe(0)
    expect(computeNightDiff({ basis, hours: 10, group: "jo_cos", rates })).toBe(0)
  })

  it("grants longevity pay per completed five-year block", () => {
    expect(computeLongevityPay(pesos(30_000), 4, rates)).toBe(0)
    expect(computeLongevityPay(pesos(30_000), 5, rates)).toBe(pesos(1_500))
    expect(computeLongevityPay(pesos(30_000), 12, rates)).toBe(pesos(3_000))
  })

  it("applies hazard pay rates by salary grade band", () => {
    expect(hazardRateFor(15, rates)).toBe(0.25)
    expect(hazardRateFor(22, rates)).toBe(0.12)
    expect(hazardRateFor(33, rates)).toBe(0.05)
    expect(computeHazardPay(pesos(40_000), 16, 22, 22, rates)).toBe(pesos(10_000))
    expect(computeHazardPay(pesos(40_000), 16, 11, 22, rates)).toBe(pesos(5_000))
    expect(computeHazardPay(pesos(40_000), 16, 0, 0, rates)).toBe(0)
  })

  it("caps subsistence days and pays laundry only when days were worked", () => {
    expect(computeSubsistenceLaundry(25, rates)).toEqual({ subsistence: pesos(1_100), laundry: pesos(150) })
    expect(computeSubsistenceLaundry(10, rates)).toEqual({ subsistence: pesos(500), laundry: pesos(150) })
    expect(computeSubsistenceLaundry(0, rates)).toEqual({ subsistence: 0, laundry: 0 })
  })
})

describe("computeGsis", () => {
  it("applies personal and government shares to earned basic", () => {
    expect(computeGsis(pesos(15_000), "plantilla", rates)).toEqual({
      personal: pesos(1_350),
      government: pesos(1_800),
      ecc: pesos(100),
    })
  })

  it("exempts JO/COS and zero earnings", () => {
    const zero = { personal: 0, government: 0, ecc: 0 }
    expect(computeGsis(pesos(15_000), "jo_cos", rates)).toEqual(zero)
    expect(computeGsis(0, "plantilla", rates)).toEqual(zero)
  })
})

describe("computePhilhealth", () => {
  it("splits the premium equally for plantilla", () => {
    expect(computePhilhealth(pesos(30_000), "plantilla", rates)).toEqual({
      employee: pesos(750),
      government: pesos(750),
    })
  })

  it("applies the floor and ceiling", () => {
    expect(computePhilhealth(pesos(8_000), "plantilla", rates).employee).toBe(pesos(250))
    expect(computePhilhealth(pesos(100_000), "plantilla", rates).employee).toBe(pesos(2_500))
    expect(computePhilhealth(pesos(250_000), "plantilla", rates).employee).toBe(pesos(2_500))
  })

  it("keeps the two shares equal to the premium when it has an odd centavo", () => {
    const r = computePhilhealth(3333333, "plantilla", rates) // premium 1,666.67
    expect(r.employee + r.government).toBe(166667)
  })

  it("has no government share for JO/COS", () => {
    expect(computePhilhealth(pesos(20_000), "jo_cos", rates)).toEqual({ employee: pesos(500), government: 0 })
  })
})

describe("computePagibig", () => {
  it("uses the low-income rate at or below the threshold", () => {
    expect(computePagibig(pesos(1_500), "plantilla", rates)).toEqual({ employee: pesos(15), government: pesos(30) })
  })

  it("caps contributions at the maximum fund salary", () => {
    expect(computePagibig(pesos(30_000), "plantilla", rates)).toEqual({ employee: pesos(200), government: pesos(200) })
    expect(computePagibig(pesos(5_000), "plantilla", rates)).toEqual({ employee: pesos(100), government: pesos(100) })
  })

  it("has no government share for JO/COS and nothing on zero pay", () => {
    expect(computePagibig(pesos(20_000), "jo_cos", rates)).toEqual({ employee: pesos(200), government: 0 })
    expect(computePagibig(0, "plantilla", rates)).toEqual({ employee: 0, government: 0 })
  })
})

describe("computeWithholdingTax", () => {
  const semi = rates.withholding.semiMonthly
  const monthly = rates.withholding.monthly
  const annual = rates.withholding.annual

  it("withholds nothing in the zero-tax bracket", () => {
    expect(computeWithholdingTax(0, semi)).toBe(0)
    expect(computeWithholdingTax(-500, semi)).toBe(0)
    expect(computeWithholdingTax(pesos(10_000), semi)).toBe(0)
    expect(computeWithholdingTax(pesos(10_417), semi)).toBe(0)
    expect(computeWithholdingTax(pesos(20_833), monthly)).toBe(0)
    expect(computeWithholdingTax(pesos(250_000), annual)).toBe(0)
  })

  it("is continuous at bracket boundaries", () => {
    expect(computeWithholdingTax(pesos(16_667), semi)).toBe(pesos("937.50"))
    expect(computeWithholdingTax(pesos(33_333), semi)).toBe(pesos("4270.70"))
    expect(computeWithholdingTax(pesos(33_333), monthly)).toBe(pesos(1_875))
  })

  it("applies the marginal rate to the excess", () => {
    expect(computeWithholdingTax(pesos(20_000), semi)).toBe(pesos("1604.10"))
    expect(computeWithholdingTax(pesos(100_000), semi)).toBe(pesos("21770.80"))
    expect(computeWithholdingTax(pesos(400_000), semi)).toBe(pesos("115104.15"))
    expect(computeWithholdingTax(pesos(25_000), monthly)).toBe(pesos("625.05"))
    expect(computeWithholdingTax(pesos(500_000), annual)).toBe(pesos(42_500))
  })

  it("withholds a flat rate from JO/COS without a sworn declaration", () => {
    expect(computeJoCosWithholding(pesos(10_000), false, rates)).toBe(pesos(500))
    expect(computeJoCosWithholding(pesos(10_000), true, rates)).toBe(0)
  })
})

describe("loans, gross, and net", () => {
  const loan: Loan = {
    id: "loan-1",
    employeeId: "emp-1",
    type: "gsis_consoloan",
    referenceNo: "CL-001",
    principal: pesos(120_000),
    monthlyAmortization: pesos("3000.01"),
    totalPayable: pesos(144_000),
    startPeriod: "2025-01-01",
    endPeriod: "2028-12-31",
    termMonths: 48,
    paidToDate: 0,
    status: "active",
  }

  it("deducts the full monthly amortization", () => {
    expect(computeLoanDeductions([loan], periodSeptember.start)[0]?.amount).toBe(300001)
  })

  it("skips loans outside their term and suspended loans", () => {
    expect(computeLoanDeductions([{ ...loan, endPeriod: "2026-08-31" }], periodSeptember.start)).toEqual([])
    expect(computeLoanDeductions([{ ...loan, startPeriod: "2026-10-01" }], periodSeptember.start)).toEqual([])
    expect(computeLoanDeductions([{ ...loan, status: "suspended" }], periodSeptember.start)).toEqual([])
  })

  it("sums gross and net", () => {
    expect(computeGross([100, 200, 300])).toBe(600)
    expect(computeNet(1000, [100, 50])).toEqual({ totalDeductions: 150, net: 850 })
  })
})

describe("computePayrollLine", () => {
  it("produces a consistent plantilla line", () => {
    const employee = makeEmployee({ allowances: [{ allowanceTypeId: "alw-ra", amount: pesos(4_000) }] })
    const line = computePayrollLine({
      employee,
      monthlyRate: pesos(40_000),
      period: periodSeptember,
      dtr: dtr({ overtimeHoursRegular: 2, nightDiffHours: 8 }),
      loans: [],
      adjustments: [],
      allowanceTypes,
      rates,
    })

    expect(line.group).toBe("plantilla")
    expect(line.basic).toBe(pesos(40_000))
    expect(line.pera).toBe(pesos(2_000))
    // RA plus longevity (11 years, 2 blocks, 10% of 40,000)
    expect(line.allowances.map((a) => a.code)).toEqual(["RA", "LP"])
    expect(line.allowancesTotal).toBe(pesos(4_000 + 4_000))
    expect(line.gross).toBe(line.basic + line.pera + line.allowancesTotal + line.overtime + line.nightDiff)
    expect(line.gsis).toBe(pesos(3_600))
    expect(line.ecc).toBe(pesos(100))
    expect(line.philhealth).toBe(pesos(1_000))
    expect(line.pagibig).toBe(pesos(200))
    expect(line.totalDeductions).toBe(
      line.gsis + line.philhealth + line.pagibig + line.withholdingTax + line.loansTotal + line.otherDeductionsTotal
    )
    expect(line.net).toBe(line.gross - line.totalDeductions)
    expect(line.withholdingTax).toBeGreaterThan(0)
    expect(line.flags).toEqual([])
  })

  it("flags missing DTR and prorates a new hire", () => {
    const line = computePayrollLine({
      employee: makeEmployee({ dateHired: "2026-09-08" }),
      monthlyRate: pesos(44_000),
      period: periodSeptember,
      loans: [],
      adjustments: [],
      allowanceTypes,
      rates,
    })
    // 44,000 x 17 of 22 working days (hired Sep 8)
    expect(line.basic).toBe(pesos(34_000))
    expect(line.flags.some((f) => f.startsWith("No DTR"))).toBe(true)
    expect(line.flags.some((f) => f.startsWith("New hire"))).toBe(true)
  })

  it("has no GSIS and no government shares for JO/COS", () => {
    const employee = makeJobOrder()
    const monthlyRate = monthlyRateFor(employee, schedule, rates)
    const line = computePayrollLine({
      employee,
      monthlyRate,
      period: periodSeptember,
      dtr: dtr({ employeeId: employee.id, daysWorked: 21, absencesWithoutPay: 1 }),
      loans: [],
      adjustments: [],
      allowanceTypes,
      rates,
    })
    expect(rateBasis(employee, monthlyRate, rates).daysDivisor).toBe(1)
    expect(line.basic).toBe(pesos(12_600))
    expect(line.pera).toBe(0)
    expect(line.gsis).toBe(0)
    expect(line.gsisGovernment).toBe(0)
    expect(line.philhealthGovernment).toBe(0)
    expect(line.pagibigGovernment).toBe(0)
    expect(line.withholdingTax).toBe(0)
  })

  it("applies manual adjustments as other earnings and deductions", () => {
    const adjustments: Adjustment[] = [
      {
        id: "adj-1",
        employeeId: "emp-1",
        kind: "earning",
        label: "Salary differential",
        amount: pesos(1_500),
        reason: "Step increment effective Aug 1",
        createdBy: "HR",
        createdAt: "2026-09-10T00:00:00.000Z",
      },
      {
        id: "adj-2",
        employeeId: "emp-1",
        kind: "deduction",
        label: "Overpayment refund",
        amount: pesos(500),
        reason: "Refund of August overpayment",
        createdBy: "HR",
        createdAt: "2026-09-10T00:00:00.000Z",
      },
    ]
    const base = {
      employee: makeEmployee(),
      monthlyRate: pesos(40_000),
      period: periodSeptember,
      dtr: dtr(),
      loans: [],
      allowanceTypes,
      rates,
    }
    const without = computePayrollLine({ ...base, adjustments: [] })
    const withAdj = computePayrollLine({ ...base, adjustments })
    expect(withAdj.gross - without.gross).toBe(pesos(1_500))
    expect(withAdj.otherDeductionsTotal).toBe(pesos(500))
    expect(withAdj.flags).toContain("2 manual adjustments.")
  })

  it("flags net pay below the GAA minimum", () => {
    const heavyLoan: Loan = {
      id: "loan-h",
      employeeId: "emp-1",
      type: "gsis_mpl",
      referenceNo: "MPL",
      principal: pesos(500_000),
      monthlyAmortization: pesos(60_000),
      totalPayable: pesos(600_000),
      startPeriod: "2025-01-01",
      endPeriod: "2027-12-31",
      termMonths: 36,
      paidToDate: 0,
      status: "active",
    }
    const line = computePayrollLine({
      employee: makeEmployee(),
      monthlyRate: pesos(40_000),
      period: periodSeptember,
      dtr: dtr(),
      loans: [heavyLoan],
      adjustments: [],
      allowanceTypes,
      rates,
    })
    expect(line.flags.some((f) => f.includes("below the minimum"))).toBe(true)
  })
})

describe("special payroll", () => {
  it("checks eligibility", () => {
    expect(isEligibleForSpecial("mid_year_bonus", makeEmployee(), "2026-05-15", rates).eligible).toBe(true)
    expect(
      isEligibleForSpecial("mid_year_bonus", makeEmployee({ dateHired: "2026-03-01" }), "2026-05-15", rates).eligible
    ).toBe(false)
    expect(isEligibleForSpecial("pei", makeJobOrder(), "2026-12-15", rates).eligible).toBe(false)
    expect(
      isEligibleForSpecial("hazard_pay", makeEmployee({ isHealthWorker: false }), "2026-08-31", rates).eligible
    ).toBe(false)
  })

  it("computes year-end bonus plus cash gift", () => {
    const line = computeSpecialLine({
      kind: "year_end_bonus",
      employee: makeEmployee(),
      monthlyRate: pesos(40_000),
      asOf: "2026-10-31",
      daysWorked: 22,
      daysRequired: 22,
      adjustments: [],
      rates,
    })
    expect(line.gross).toBe(pesos(45_000))
    expect(line.net).toBe(pesos(45_000))
  })
})
