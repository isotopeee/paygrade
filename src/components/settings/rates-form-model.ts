import { z } from "zod"

import type { RatesConfig, TaxBracket } from "@/types"
import { pesos, toPesos } from "@/lib/payroll/money"

/**
 * Form model for a rates version. Money is edited in pesos and rates in
 * percent; `fromForm` converts back to centavos and decimals.
 */

const num = (label: string) => z.number({ error: `Enter ${label}` }).min(0, `${label} cannot be negative`)
const pct = (label: string) => num(label).max(100, `${label} cannot exceed 100%`)

const bracketSchema = z
  .object({
    over: num("the lower bound"),
    upTo: z.number({ error: "Enter the upper bound" }).nullable(),
    baseTax: num("the base tax"),
    rate: pct("the rate"),
  })
  .refine((b) => b.upTo === null || b.upTo > b.over, { message: "Must be greater than Over", path: ["upTo"] })

const bracketsSchema = z
  .array(bracketSchema)
  .min(1, "Add at least one bracket")
  .refine((rows) => rows.every((r, i) => i === 0 || r.over >= (rows[i - 1]?.over ?? 0)), {
    message: "Brackets must be in ascending order",
  })
  .refine((rows) => rows.every((r, i) => i === rows.length - 1 || r.upTo !== null), {
    message: "Only the top bracket can have no upper limit",
  })

export function ratesFormSchema(existingDates: readonly string[]) {
  return z.object({
    label: z.string().trim().min(3, "Enter a label of at least 3 characters"),
    legalBasis: z.string().trim().min(3, "Enter the legal basis"),
    effectivityDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the effectivity date")
      .refine((d) => !existingDates.includes(d), "Another version already takes effect on this date"),
    gsis: z.object({
      personalRate: pct("the personal share"),
      governmentRate: pct("the government share"),
      eccMonthly: num("the ECC amount"),
    }),
    philhealth: z
      .object({
        premiumRate: pct("the premium rate"),
        employeeShare: pct("the employee share"),
        floor: num("the floor"),
        ceiling: num("the ceiling"),
      })
      .refine((p) => p.ceiling >= p.floor, { message: "Ceiling must be at least the floor", path: ["ceiling"] }),
    pagibig: z.object({
      employeeRateLow: pct("the low-income employee rate"),
      employeeRate: pct("the employee rate"),
      employerRate: pct("the employer rate"),
      lowIncomeThreshold: num("the threshold"),
      maxFundSalary: num("the maximum fund salary"),
    }),
    withholding: z.object({
      semiMonthly: bracketsSchema,
      monthly: bracketsSchema,
      annual: bracketsSchema,
    }),
    peraMonthly: num("the PERA amount"),
    workingDaysPerMonth: num("working days").min(1, "At least 1 day").max(31, "At most 31 days"),
    hoursPerDay: num("hours per day").min(1, "At least 1 hour").max(24, "At most 24 hours"),
    overtime: z.object({
      regularDayMultiplier: num("the multiplier"),
      restDayMultiplier: num("the multiplier"),
    }),
    nightDiff: z.object({
      rate: pct("the rate"),
      maxSalaryGrade: z.number({ error: "Enter a salary grade" }).int("Whole number").min(1).max(33),
    }),
    minimumNetPayMonthly: num("the minimum net pay"),
    joCos: z.object({ withholdingRate: pct("the rate") }),
    magnaCarta: z.object({
      subsistencePerDay: num("the daily subsistence"),
      subsistenceMaxDays: num("max days").int("Whole number"),
      laundryMonthly: num("the laundry allowance"),
      hazardRates: z
        .array(
          z.object({
            maxSalaryGrade: z.number({ error: "Enter a salary grade" }).int("Whole number").min(1).max(33),
            rate: pct("the rate"),
          })
        )
        .min(1, "Add at least one band"),
      longevityRate: pct("the rate"),
      longevityYearsPerBlock: num("years").int("Whole number").min(1),
    }),
    bonuses: z.object({
      cashGift: num("the cash gift"),
      pei: num("the PEI amount"),
      uniformAllowance: num("the uniform allowance"),
      minimumMonthsForBonus: num("months").int("Whole number"),
      exemptionCeiling: num("the exemption ceiling"),
    }),
    leaveMonetization: z.object({
      retainedDays: num("days"),
      maxDaysPerApplication: num("days").int("Whole number").min(1),
    }),
  })
}

export type RatesFormValues = z.infer<ReturnType<typeof ratesFormSchema>>

const toPct = (rate: number) => Number((rate * 100).toFixed(6))
const fromPct = (value: number) => Number((value / 100).toFixed(8))

function bracketsToForm(rows: readonly TaxBracket[]) {
  return rows.map((b) => ({
    over: toPesos(b.over),
    upTo: b.upTo === null ? null : toPesos(b.upTo),
    baseTax: toPesos(b.baseTax),
    rate: toPct(b.rate),
  }))
}

function bracketsFromForm(rows: RatesFormValues["withholding"]["annual"]): TaxBracket[] {
  return rows.map((b) => ({
    over: pesos(b.over),
    upTo: b.upTo === null ? null : pesos(b.upTo),
    baseTax: pesos(b.baseTax),
    rate: fromPct(b.rate),
  }))
}

export function toForm(r: RatesConfig): RatesFormValues {
  return {
    label: `${r.label} (revised)`,
    legalBasis: r.legalBasis,
    effectivityDate: "",
    gsis: {
      personalRate: toPct(r.gsis.personalRate),
      governmentRate: toPct(r.gsis.governmentRate),
      eccMonthly: toPesos(r.gsis.eccMonthly),
    },
    philhealth: {
      premiumRate: toPct(r.philhealth.premiumRate),
      employeeShare: toPct(r.philhealth.employeeShare),
      floor: toPesos(r.philhealth.floor),
      ceiling: toPesos(r.philhealth.ceiling),
    },
    pagibig: {
      employeeRateLow: toPct(r.pagibig.employeeRateLow),
      employeeRate: toPct(r.pagibig.employeeRate),
      employerRate: toPct(r.pagibig.employerRate),
      lowIncomeThreshold: toPesos(r.pagibig.lowIncomeThreshold),
      maxFundSalary: toPesos(r.pagibig.maxFundSalary),
    },
    withholding: {
      semiMonthly: bracketsToForm(r.withholding.semiMonthly),
      monthly: bracketsToForm(r.withholding.monthly),
      annual: bracketsToForm(r.withholding.annual),
    },
    peraMonthly: toPesos(r.peraMonthly),
    workingDaysPerMonth: r.workingDaysPerMonth,
    hoursPerDay: r.hoursPerDay,
    overtime: { ...r.overtime },
    nightDiff: { rate: toPct(r.nightDiff.rate), maxSalaryGrade: r.nightDiff.maxSalaryGrade },
    minimumNetPayMonthly: toPesos(r.minimumNetPayMonthly),
    joCos: { withholdingRate: toPct(r.joCos.withholdingRate) },
    magnaCarta: {
      subsistencePerDay: toPesos(r.magnaCarta.subsistencePerDay),
      subsistenceMaxDays: r.magnaCarta.subsistenceMaxDays,
      laundryMonthly: toPesos(r.magnaCarta.laundryMonthly),
      hazardRates: r.magnaCarta.hazardRates.map((h) => ({ maxSalaryGrade: h.maxSalaryGrade, rate: toPct(h.rate) })),
      longevityRate: toPct(r.magnaCarta.longevityRate),
      longevityYearsPerBlock: r.magnaCarta.longevityYearsPerBlock,
    },
    bonuses: {
      cashGift: toPesos(r.bonuses.cashGift),
      pei: toPesos(r.bonuses.pei),
      uniformAllowance: toPesos(r.bonuses.uniformAllowance),
      minimumMonthsForBonus: r.bonuses.minimumMonthsForBonus,
      exemptionCeiling: toPesos(r.bonuses.exemptionCeiling),
    },
    leaveMonetization: { ...r.leaveMonetization },
  }
}

export function fromForm(v: RatesFormValues): Omit<RatesConfig, "id" | "createdAt" | "createdBy"> {
  return {
    label: v.label.trim(),
    legalBasis: v.legalBasis.trim(),
    effectivityDate: v.effectivityDate,
    gsis: {
      personalRate: fromPct(v.gsis.personalRate),
      governmentRate: fromPct(v.gsis.governmentRate),
      eccMonthly: pesos(v.gsis.eccMonthly),
    },
    philhealth: {
      premiumRate: fromPct(v.philhealth.premiumRate),
      employeeShare: fromPct(v.philhealth.employeeShare),
      floor: pesos(v.philhealth.floor),
      ceiling: pesos(v.philhealth.ceiling),
    },
    pagibig: {
      employeeRateLow: fromPct(v.pagibig.employeeRateLow),
      employeeRate: fromPct(v.pagibig.employeeRate),
      employerRate: fromPct(v.pagibig.employerRate),
      lowIncomeThreshold: pesos(v.pagibig.lowIncomeThreshold),
      maxFundSalary: pesos(v.pagibig.maxFundSalary),
    },
    withholding: {
      semiMonthly: bracketsFromForm(v.withholding.semiMonthly),
      monthly: bracketsFromForm(v.withholding.monthly),
      annual: bracketsFromForm(v.withholding.annual),
    },
    peraMonthly: pesos(v.peraMonthly),
    workingDaysPerMonth: v.workingDaysPerMonth,
    hoursPerDay: v.hoursPerDay,
    overtime: { ...v.overtime },
    nightDiff: { rate: fromPct(v.nightDiff.rate), maxSalaryGrade: v.nightDiff.maxSalaryGrade },
    minimumNetPayMonthly: pesos(v.minimumNetPayMonthly),
    joCos: { withholdingRate: fromPct(v.joCos.withholdingRate) },
    magnaCarta: {
      subsistencePerDay: pesos(v.magnaCarta.subsistencePerDay),
      subsistenceMaxDays: v.magnaCarta.subsistenceMaxDays,
      laundryMonthly: pesos(v.magnaCarta.laundryMonthly),
      hazardRates: v.magnaCarta.hazardRates.map((h) => ({ maxSalaryGrade: h.maxSalaryGrade, rate: fromPct(h.rate) })),
      longevityRate: fromPct(v.magnaCarta.longevityRate),
      longevityYearsPerBlock: v.magnaCarta.longevityYearsPerBlock,
    },
    bonuses: {
      cashGift: pesos(v.bonuses.cashGift),
      pei: pesos(v.bonuses.pei),
      uniformAllowance: pesos(v.bonuses.uniformAllowance),
      minimumMonthsForBonus: v.bonuses.minimumMonthsForBonus,
      exemptionCeiling: pesos(v.bonuses.exemptionCeiling),
    },
    leaveMonetization: { ...v.leaveMonetization },
  }
}
