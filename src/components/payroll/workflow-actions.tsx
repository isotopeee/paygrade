"use client"

import { useState } from "react"
import {
  BadgeCheckIcon,
  CalculatorIcon,
  CircleCheckBigIcon,
  EyeIcon,
  LockIcon,
  RefreshCwIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { PayrollRun, RunStatus } from "@/types"
import { ROLE_LABELS, RUN_STATUS_LABELS } from "@/lib/constants"
import { formatCurrency } from "@/lib/format"
import { canAdvance, canReturn, nextStep, returnTargets } from "@/lib/workflow"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface AdvanceCopy {
  icon: LucideIcon
  title: string
  description: string
  attestation: string
  confirm: string
  success: string
}

const ADVANCE_COPY: Partial<Record<RunStatus, AdvanceCopy>> = {
  reviewed: {
    icon: EyeIcon,
    title: "Mark payroll as reviewed",
    description: "Forward the register to the Accounting Section for certification.",
    attestation:
      "I have reviewed the payroll register, the computation breakdowns, and every exception and manual adjustment in this run.",
    confirm: "Mark as reviewed",
    success: "Payroll forwarded to Accounting for certification",
  },
  certified: {
    icon: BadgeCheckIcon,
    title: "Certify payroll",
    description: "Certify the payroll for approval of the Chief of Hospital.",
    attestation:
      "I certify that supporting documents are complete and proper, deductions are correct, and allotment and cash are available for this payroll.",
    confirm: "Certify payroll",
    success: "Payroll certified and forwarded to the Chief of Hospital",
  },
  approved: {
    icon: LockIcon,
    title: "Approve payroll",
    description: "Approve the payroll for payment. The run is locked after approval and can no longer be edited or returned.",
    attestation: "I approve this payroll for payment. Services have been duly rendered as stated.",
    confirm: "Approve and lock",
    success: "Payroll approved and locked",
  },
  released: {
    icon: CircleCheckBigIcon,
    title: "Release payroll",
    description: "Record the release of salaries through the Landbank ATM payroll credit.",
    attestation: "Salaries have been credited to employee payroll accounts per the Landbank credit advice.",
    confirm: "Release payroll",
    success: "Payroll released",
  },
}

export function WorkflowActions({ run }: { run: PayrollRun }) {
  const role = useRole()
  const computeRun = useDataStore((s) => s.computeRun)
  const advanceRun = useDataStore((s) => s.advanceRun)
  const returnRun = useDataStore((s) => s.returnRun)

  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [attested, setAttested] = useState(false)
  const [comment, setComment] = useState("")
  const [returnTo, setReturnTo] = useState<RunStatus | "">("")
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)

  if (!role) return null
  const step = nextStep(run.status)
  const mayAdvance = canAdvance(run, role)
  const mayReturn = canReturn(run, role)
  const targets = returnTargets(run.status)
  const copy = step ? ADVANCE_COPY[step.status] : undefined
  const exceptions = run.lines.filter((l) => l.flags.length > 0).length

  const openAdvance = () => {
    setAttested(false)
    setComment("")
    setAdvanceOpen(true)
  }

  const openReturn = () => {
    setReturnTo(targets[targets.length - 1] ?? "")
    setReason("")
    setReasonError(null)
    setReturnOpen(true)
  }

  const compute = () => {
    computeRun(run.id)
    const after = useDataStore.getState().runs.find((r) => r.id === run.id)
    toast.success(run.status === "draft" ? "Payroll computed" : "Payroll recomputed", {
      description: after ? `${after.totals.headcount} employees, net pay ${formatCurrency(after.totals.net)}` : undefined,
    })
  }

  const submitAdvance = () => {
    if (!copy) return
    advanceRun(run.id, comment.trim() || undefined)
    setAdvanceOpen(false)
    toast.success(copy.success)
  }

  const submitReturn = () => {
    if (!returnTo) return
    if (reason.trim().length < 10) {
      setReasonError("Explain what needs to be corrected (at least 10 characters).")
      return
    }
    returnRun(run.id, returnTo, reason.trim())
    setReturnOpen(false)
    toast.success(`Payroll returned to ${RUN_STATUS_LABELS[returnTo]}`)
  }

  const waitingOn = step ? ROLE_LABELS[step.actor] : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {run.status === "computed" && role === "hr" && (
        <Button variant="outline" onClick={compute}>
          <RefreshCwIcon data-icon="inline-start" aria-hidden />
          Recompute
        </Button>
      )}

      {mayReturn && (
        <Button variant="outline" onClick={openReturn}>
          <Undo2Icon data-icon="inline-start" aria-hidden />
          Return
        </Button>
      )}

      {step && run.status === "draft" && mayAdvance && (
        <Button onClick={compute} disabled={run.employeeIds.length === 0}>
          <CalculatorIcon data-icon="inline-start" aria-hidden />
          Compute payroll
        </Button>
      )}

      {step && run.status !== "draft" && copy && (
        mayAdvance ? (
          <Button onClick={openAdvance}>
            <copy.icon data-icon="inline-start" aria-hidden />
            {copy.confirm}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="rounded-lg" />}>
              <Button disabled aria-disabled>
                <copy.icon data-icon="inline-start" aria-hidden />
                {copy.confirm}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Only the {waitingOn} can perform this step. Switch roles from the user menu.</TooltipContent>
          </Tooltip>
        )
      )}

      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="sm:max-w-lg">
          {copy && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Employees</div>
                  <div className="font-medium tabular-nums">{run.totals.headcount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gross pay</div>
                  <div className="font-medium tabular-nums">{formatCurrency(run.totals.gross)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Net pay</div>
                  <div className="font-medium tabular-nums">{formatCurrency(run.totals.net)}</div>
                </div>
              </div>
              {exceptions > 0 && step?.status === "reviewed" && (
                <p className="text-xs text-muted-foreground">
                  {exceptions} employee{exceptions === 1 ? " has" : "s have"} computation notes. Check the Exceptions tab
                  before forwarding.
                </p>
              )}
              <Field orientation="horizontal" className="items-start rounded-lg border p-3">
                <Checkbox id="attest" checked={attested} onCheckedChange={(v) => setAttested(!!v)} />
                <FieldLabel htmlFor="attest" className="text-sm leading-snug font-normal">
                  {copy.attestation}
                </FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="advance-comment">Comment (optional)</FieldLabel>
                <Textarea
                  id="advance-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Visible in the run activity log"
                  rows={2}
                />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdvanceOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitAdvance} disabled={!attested}>
                  {copy.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Return payroll for correction</DialogTitle>
            <DialogDescription>
              The run moves back to an earlier stage. Everyone who acts on it will see your reason in the activity log.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="return-to">Return to</FieldLabel>
            <NativeSelect id="return-to" value={returnTo} onChange={(e) => setReturnTo(e.target.value as RunStatus)}>
              {targets.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {RUN_STATUS_LABELS[t]}
                  {t === "computed" ? " (HR corrects and recomputes)" : t === "reviewed" ? " (Accounting re-certifies)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={reasonError ? true : undefined}>
            <FieldLabel htmlFor="return-reason">Reason</FieldLabel>
            <Textarea
              id="return-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError(null)
              }}
              aria-invalid={reasonError ? true : undefined}
              placeholder="For example: Overtime for Nursing on Sep 21 to 25 is not covered by an approved OT authority."
              rows={3}
            />
            <FieldDescription>Required. Be specific about the employees and items to correct.</FieldDescription>
            {reasonError && <FieldError>{reasonError}</FieldError>}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReturn}>
              <Undo2Icon data-icon="inline-start" aria-hidden />
              Return payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
