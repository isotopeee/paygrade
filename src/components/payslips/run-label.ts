import type { PayrollRun } from "@/types"
import { GROUP_LABELS } from "@/lib/constants"
import { formatPeriod } from "@/lib/format"

/** Selector label for a payroll run, for example `Sep 1 to 15, 2026 · Plantilla`. */
export function payslipRunLabel(run: PayrollRun): string {
  const main = run.type === "regular" ? formatPeriod(run.periodStart, run.periodEnd) : run.title
  return `${main} · ${GROUP_LABELS[run.group]}`
}

/** Non-draft runs that have lines, newest pay date first. */
export function payslipRuns(runs: readonly PayrollRun[]): PayrollRun[] {
  return runs
    .filter((r) => r.status !== "draft" && r.lines.length > 0)
    .sort(
      (a, b) =>
        b.payDate.localeCompare(a.payDate) ||
        b.periodStart.localeCompare(a.periodStart) ||
        a.group.localeCompare(b.group) ||
        a.code.localeCompare(b.code)
    )
}

/** Payslips can be generated once a run is approved. */
export function canGenerateFor(run: PayrollRun): boolean {
  return run.status === "approved" || run.status === "released"
}

/** Default run for the payslips page: the latest released regular Plantilla run. */
export function defaultPayslipRun(runs: readonly PayrollRun[]): PayrollRun | undefined {
  const list = payslipRuns(runs)
  return (
    list.find((r) => r.type === "regular" && r.group === "plantilla" && r.status === "released") ??
    list.find((r) => r.status === "released") ??
    list[0]
  )
}
