/**
 * Salary schedule seed (Salary Standardization Law VI, EO 64 s. 2024 tranches).
 *
 * Seed values for prototype only. Step 1 anchors approximate the first tranche;
 * later tranches and steps are derived. Verify every cell against the DBM
 * National Budget Circular before production use.
 */

import type { SalarySchedule } from "@/types"
import { pesos } from "@/lib/payroll/money"

/** Monthly salary, Step 1, SG 1 to 33, first tranche (pesos). */
const FIRST_TRANCHE_STEP1 = [
  13_530, 14_372, 15_265, 16_209, 17_205, 18_255, 19_365, 20_534, 22_219, 24_381,
  28_512, 30_705, 32_870, 35_434, 38_413, 41_616, 45_138, 49_015, 53_873, 60_157,
  67_005, 74_836, 83_659, 94_132, 106_765, 120_851, 136_881, 155_093, 176_385, 200_562,
  290_630, 344_875, 432_501,
]

function stepIncrement(grade: number): number {
  return Math.min(0.009 + 0.0004 * (grade - 1), 0.025)
}

function buildMatrix(trancheFactor: number): number[][] {
  return FIRST_TRANCHE_STEP1.map((step1, g) => {
    const grade = g + 1
    const inc = stepIncrement(grade)
    return Array.from({ length: 8 }, (_, s) => {
      const value = Math.round(step1 * trancheFactor * Math.pow(1 + inc, s))
      return pesos(value)
    })
  })
}

export const SEED_SALARY_SCHEDULES: SalarySchedule[] = [
  {
    id: "ssl6-t1",
    name: "SSL VI First Tranche",
    legalBasis: "EO 64 s. 2024; NBC No. 594",
    effectivityDate: "2024-01-01",
    matrix: buildMatrix(1),
    createdBy: "System seed",
    createdAt: "2024-08-12T09:00:00.000+08:00",
  },
  {
    id: "ssl6-t2",
    name: "SSL VI Second Tranche",
    legalBasis: "EO 64 s. 2024; NBC No. 597",
    effectivityDate: "2025-01-01",
    matrix: buildMatrix(1.04),
    createdBy: "System seed",
    createdAt: "2025-01-06T09:00:00.000+08:00",
  },
  {
    id: "ssl6-t3",
    name: "SSL VI Third Tranche",
    legalBasis: "EO 64 s. 2024; NBC No. 601",
    effectivityDate: "2026-01-01",
    matrix: buildMatrix(1.04 * 1.04),
    createdBy: "System seed",
    createdAt: "2026-01-05T09:00:00.000+08:00",
  },
]
