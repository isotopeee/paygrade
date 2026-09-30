import type { PayrollLine, RunTotals } from "@/types"

import { sumBy } from "./money"

export const EMPTY_TOTALS: RunTotals = {
  headcount: 0,
  gross: 0,
  totalDeductions: 0,
  net: 0,
  gsis: 0,
  gsisGovernment: 0,
  ecc: 0,
  philhealth: 0,
  philhealthGovernment: 0,
  pagibig: 0,
  pagibigGovernment: 0,
  withholdingTax: 0,
  loans: 0,
}

export function computeRunTotals(lines: readonly PayrollLine[]): RunTotals {
  return {
    headcount: lines.length,
    gross: sumBy(lines, (l) => l.gross),
    totalDeductions: sumBy(lines, (l) => l.totalDeductions),
    net: sumBy(lines, (l) => l.net),
    gsis: sumBy(lines, (l) => l.gsis),
    gsisGovernment: sumBy(lines, (l) => l.gsisGovernment),
    ecc: sumBy(lines, (l) => l.ecc),
    philhealth: sumBy(lines, (l) => l.philhealth),
    philhealthGovernment: sumBy(lines, (l) => l.philhealthGovernment),
    pagibig: sumBy(lines, (l) => l.pagibig),
    pagibigGovernment: sumBy(lines, (l) => l.pagibigGovernment),
    withholdingTax: sumBy(lines, (l) => l.withholdingTax),
    loans: sumBy(lines, (l) => l.loansTotal),
  }
}
