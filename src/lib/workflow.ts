import type { PayrollRun, Role, RunStatus } from "@/types"

import { RUN_STATUS_ORDER } from "./constants"

/**
 * Payroll run workflow:
 * Draft > Computed > Reviewed (HR) > Certified (Accounting) > Approved (Chief of Hospital) > Released (Cashier)
 *
 * Each status has one role that can move it forward. The same role can return
 * the run to an earlier stage (never to Draft) with a required comment. The
 * run locks once approved.
 */

export interface WorkflowStep {
  status: RunStatus
  /** Role that performs the action that moves a run INTO this status. */
  actor: Role
  /** Verb shown on the action button. */
  action: string
  /** Past-tense description for the stepper. */
  description: string
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { status: "draft", actor: "hr", action: "Create run", description: "Run created" },
  { status: "computed", actor: "hr", action: "Compute payroll", description: "Payroll computed" },
  { status: "reviewed", actor: "hr", action: "Mark as reviewed", description: "Reviewed by HR" },
  { status: "certified", actor: "accountant", action: "Certify", description: "Certified by Accounting" },
  { status: "approved", actor: "chief", action: "Approve", description: "Approved by Chief of Hospital" },
  { status: "released", actor: "cashier", action: "Release", description: "Released by Cashier" },
]

export function statusIndex(status: RunStatus): number {
  return RUN_STATUS_ORDER.indexOf(status)
}

export function nextStatus(status: RunStatus): RunStatus | null {
  return RUN_STATUS_ORDER[statusIndex(status) + 1] ?? null
}

export function stepFor(status: RunStatus): WorkflowStep {
  const step = WORKFLOW_STEPS.find((s) => s.status === status)
  if (!step) throw new Error(`Unknown status ${status}`)
  return step
}

/** The step that would come next for a run, or null when released. */
export function nextStep(status: RunStatus): WorkflowStep | null {
  const next = nextStatus(status)
  return next ? stepFor(next) : null
}

/** Role that currently holds the run (the one who must act next). */
export function currentOwner(status: RunStatus): Role | null {
  return nextStep(status)?.actor ?? null
}

export function canAdvance(run: Pick<PayrollRun, "status">, role: Role): boolean {
  return currentOwner(run.status) === role
}

export function isLocked(status: RunStatus): boolean {
  return statusIndex(status) >= statusIndex("approved")
}

/** Earlier stages a run can be returned to. Draft is excluded: returning means rework, not deletion. */
export function returnTargets(status: RunStatus): RunStatus[] {
  if (isLocked(status)) return []
  const idx = statusIndex(status)
  return RUN_STATUS_ORDER.slice(1, idx)
}

export function canReturn(run: Pick<PayrollRun, "status">, role: Role): boolean {
  return returnTargets(run.status).length > 0 && currentOwner(run.status) === role
}

/** Adjustments are allowed only while HR holds a computed run. */
export function canAdjust(run: Pick<PayrollRun, "status" | "locked">, role: Role): boolean {
  return role === "hr" && run.status === "computed" && !run.locked
}
