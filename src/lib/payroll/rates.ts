/**
 * Seed values for prototype only. Verify against current GSIS, PhilHealth,
 * HDMF, BIR, and DBM issuances before production use.
 *
 * Every rate, ceiling, bracket, and default amount used by the payroll engine
 * lives in this file. Components and computation functions must read from a
 * `RatesConfig` object (seeded from here and versioned in Settings) and never
 * hardcode these numbers.
 */

import type { AllowanceType, RatesConfig, TaxBracket } from "@/types"

import { pesos } from "./money"

/* ------------------------------------------------------------------ */
/* BIR withholding tax on compensation (TRAIN law, RR 11-2018 Annex E, */
/* schedule effective January 1, 2023 onward)                          */
/* ------------------------------------------------------------------ */

export const WITHHOLDING_SEMI_MONTHLY: TaxBracket[] = [
  { over: 0, upTo: pesos(10_417), baseTax: 0, rate: 0 },
  { over: pesos(10_417), upTo: pesos(16_667), baseTax: 0, rate: 0.15 },
  { over: pesos(16_667), upTo: pesos(33_333), baseTax: pesos("937.50"), rate: 0.2 },
  { over: pesos(33_333), upTo: pesos(83_333), baseTax: pesos("4270.70"), rate: 0.25 },
  { over: pesos(83_333), upTo: pesos(333_333), baseTax: pesos("16770.70"), rate: 0.3 },
  { over: pesos(333_333), upTo: null, baseTax: pesos("91770.70"), rate: 0.35 },
]

export const WITHHOLDING_MONTHLY: TaxBracket[] = [
  { over: 0, upTo: pesos(20_833), baseTax: 0, rate: 0 },
  { over: pesos(20_833), upTo: pesos(33_333), baseTax: 0, rate: 0.15 },
  { over: pesos(33_333), upTo: pesos(66_667), baseTax: pesos(1_875), rate: 0.2 },
  { over: pesos(66_667), upTo: pesos(166_667), baseTax: pesos("8541.80"), rate: 0.25 },
  { over: pesos(166_667), upTo: pesos(666_667), baseTax: pesos("33541.80"), rate: 0.3 },
  { over: pesos(666_667), upTo: null, baseTax: pesos("183541.80"), rate: 0.35 },
]

export const WITHHOLDING_ANNUAL: TaxBracket[] = [
  { over: 0, upTo: pesos(250_000), baseTax: 0, rate: 0 },
  { over: pesos(250_000), upTo: pesos(400_000), baseTax: 0, rate: 0.15 },
  { over: pesos(400_000), upTo: pesos(800_000), baseTax: pesos(22_500), rate: 0.2 },
  { over: pesos(800_000), upTo: pesos(2_000_000), baseTax: pesos(102_500), rate: 0.25 },
  { over: pesos(2_000_000), upTo: pesos(8_000_000), baseTax: pesos(402_500), rate: 0.3 },
  { over: pesos(8_000_000), upTo: null, baseTax: pesos(2_202_500), rate: 0.35 },
]

/* ------------------------------------------------------------------ */
/* Contribution and benefit rates                                      */
/* ------------------------------------------------------------------ */

const BASE_RATES: Omit<RatesConfig, "id" | "label" | "effectivityDate" | "legalBasis" | "createdAt"> = {
  createdBy: "System seed",
  gsis: {
    // RA 8291: 9% personal share, 12% government share of monthly basic salary
    personalRate: 0.09,
    governmentRate: 0.12,
    eccMonthly: pesos(100),
  },
  philhealth: {
    // UHC Act premium schedule: 5% of monthly basic, shared equally
    premiumRate: 0.05,
    employeeShare: 0.5,
    floor: pesos(10_000),
    ceiling: pesos(100_000),
  },
  pagibig: {
    // HDMF Circular 460: 1% or 2% employee, 2% employer, fund salary capped at 10,000
    employeeRateLow: 0.01,
    employeeRate: 0.02,
    employerRate: 0.02,
    lowIncomeThreshold: pesos(1_500),
    maxFundSalary: pesos(10_000),
  },
  withholding: {
    semiMonthly: WITHHOLDING_SEMI_MONTHLY,
    monthly: WITHHOLDING_MONTHLY,
    annual: WITHHOLDING_ANNUAL,
  },
  peraMonthly: pesos(2_000),
  workingDaysPerMonth: 22,
  hoursPerDay: 8,
  overtime: {
    // CSC-DBM Joint Circular No. 2, s. 2015
    regularDayMultiplier: 1.25,
    restDayMultiplier: 1.5,
  },
  nightDiff: {
    // RA 11701: up to 20% of hourly basic for work between 6:00 PM and 6:00 AM, SG 19 and below
    rate: 0.2,
    maxSalaryGrade: 19,
  },
  minimumNetPayMonthly: pesos(5_000),
  joCos: {
    withholdingRate: 0.05,
  },
  magnaCarta: {
    // RA 7305 and DOH-DBM joint circulars
    subsistencePerDay: pesos(50),
    subsistenceMaxDays: 22,
    laundryMonthly: pesos(150),
    hazardRates: [
      { maxSalaryGrade: 19, rate: 0.25 },
      { maxSalaryGrade: 20, rate: 0.15 },
      { maxSalaryGrade: 21, rate: 0.13 },
      { maxSalaryGrade: 22, rate: 0.12 },
      { maxSalaryGrade: 23, rate: 0.11 },
      { maxSalaryGrade: 24, rate: 0.1 },
      { maxSalaryGrade: 25, rate: 0.09 },
      { maxSalaryGrade: 26, rate: 0.08 },
      { maxSalaryGrade: 27, rate: 0.07 },
      { maxSalaryGrade: 28, rate: 0.06 },
      { maxSalaryGrade: 33, rate: 0.05 },
    ],
    longevityRate: 0.05,
    longevityYearsPerBlock: 5,
  },
  bonuses: {
    cashGift: pesos(5_000),
    pei: pesos(5_000),
    uniformAllowance: pesos(7_000),
    minimumMonthsForBonus: 4,
    // RA 10963 (TRAIN): 13th month pay and other benefits exempt up to 90,000 a year
    exemptionCeiling: pesos(90_000),
  },
  leaveMonetization: {
    // Seed rule to confirm with HR against CSC and DBM rules on leave monetization
    retainedDays: 5,
    maxDaysPerApplication: 10,
  },
}

export const SEED_RATES: RatesConfig[] = [
  {
    ...BASE_RATES,
    id: "rates-2024",
    label: "CY 2024 schedule",
    effectivityDate: "2024-01-01",
    legalBasis: "PhilHealth Circular 2020-0005, HDMF Circular 274, RR 11-2018",
    createdAt: "2024-01-02T08:00:00.000Z",
    pagibig: { ...BASE_RATES.pagibig, employeeRate: 0.02, maxFundSalary: pesos(5_000) },
  },
  {
    ...BASE_RATES,
    id: "rates-2025",
    label: "CY 2025 onward",
    effectivityDate: "2025-01-01",
    legalBasis: "PhilHealth Circular 2024-0009, HDMF Circular 460, RR 11-2018 Annex E",
    createdAt: "2025-01-03T08:00:00.000Z",
  },
]

/* ------------------------------------------------------------------ */
/* Allowance and benefit types                                         */
/* ------------------------------------------------------------------ */

export const SEED_ALLOWANCE_TYPES: AllowanceType[] = [
  {
    id: "alw-ra",
    code: "RA",
    name: "Representation Allowance",
    defaultMonthly: pesos(5_000),
    taxable: false,
    appliesTo: "plantilla",
    legalBasis: "General Appropriations Act, Sec. on RATA",
    active: true,
  },
  {
    id: "alw-ta",
    code: "TA",
    name: "Transportation Allowance",
    defaultMonthly: pesos(5_000),
    taxable: false,
    appliesTo: "plantilla",
    legalBasis: "General Appropriations Act, Sec. on RATA",
    active: true,
  },
  {
    id: "alw-longevity",
    code: "LP",
    name: "Longevity Pay (Magna Carta)",
    defaultMonthly: 0,
    taxable: true,
    appliesTo: "plantilla",
    legalBasis: "RA 7305, Sec. 23",
    active: true,
  },
  {
    id: "alw-hazard",
    code: "HP",
    name: "Hazard Pay",
    defaultMonthly: 0,
    taxable: true,
    appliesTo: "plantilla",
    legalBasis: "RA 7305, Sec. 21; DOH-DBM Joint Circular No. 1, s. 2012",
    active: true,
  },
  {
    id: "alw-subsistence",
    code: "SA",
    name: "Subsistence Allowance",
    defaultMonthly: pesos(1_100),
    taxable: false,
    appliesTo: "plantilla",
    legalBasis: "RA 7305, Sec. 22",
    active: true,
  },
  {
    id: "alw-laundry",
    code: "LA",
    name: "Laundry Allowance",
    defaultMonthly: pesos(150),
    taxable: false,
    appliesTo: "plantilla",
    legalBasis: "RA 7305, Sec. 22",
    active: true,
  },
  {
    id: "alw-uniform",
    code: "UA",
    name: "Uniform or Clothing Allowance",
    defaultMonthly: 0,
    taxable: false,
    appliesTo: "plantilla",
    legalBasis: "DBM Budget Circular on Uniform Allowance",
    active: true,
  },
]

/** Day of the following month each remittance is due. */
export const REMITTANCE_DUE_DAY = {
  gsis: 10,
  philhealth: 15,
  pagibig: 15,
  bir: 10,
} as const

/** Allowance type ids that are paid in the regular monthly payroll. */
export const REGULAR_PAYROLL_ALLOWANCE_IDS = ["alw-ra", "alw-ta", "alw-longevity"] as const

/**
 * Returns the rates version in force on a given date: the latest version whose
 * effectivity date is on or before `date`.
 */
export function ratesForDate(versions: readonly RatesConfig[], date: string): RatesConfig {
  const sorted = [...versions].sort((a, b) => a.effectivityDate.localeCompare(b.effectivityDate))
  let current = sorted[0]
  for (const version of sorted) {
    if (version.effectivityDate <= date) current = version
  }
  if (!current) throw new Error("No rates configuration available")
  return current
}
