"use client"

import * as React from "react"
import { LayersIcon } from "lucide-react"

import type { PayrollRun } from "@/types"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RunStatusBadge } from "@/components/status-badge"

import { canGenerateFor, payslipRunLabel } from "./run-label"

/** Pick several approved or released runs and generate their payslips in one job. */
export function BatchGenerateDialog({
  runs,
  onStart,
}: {
  runs: PayrollRun[]
  onStart: (runs: PayrollRun[]) => void
}) {
  const eligible = React.useMemo(() => runs.filter(canGenerateFor), [runs])
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const openWithDefaults = (next: boolean) => {
    if (next) setSelected(new Set(eligible.filter((r) => !r.payslipsGeneratedAt).map((r) => r.id)))
    setOpen(next)
  }

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const chosen = eligible.filter((r) => selected.has(r.id))
  const employees = chosen.reduce((n, r) => n + r.lines.length, 0)

  return (
    <Dialog open={open} onOpenChange={openWithDefaults}>
      <DialogTrigger render={<Button variant="outline" disabled={eligible.length === 0} />}>
        <LayersIcon data-icon="inline-start" aria-hidden />
        Batch generate
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate payslips for several runs</DialogTitle>
          <DialogDescription>
            Only approved or released payroll runs are listed. Runs without payslips are selected by default.
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto" aria-label="Eligible payroll runs">
          {eligible.map((run) => {
            const id = `batch-run-${run.id}`
            return (
              <li key={run.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60"
                >
                  <Checkbox
                    id={id}
                    checked={selected.has(run.id)}
                    onCheckedChange={(checked) => toggle(run.id, checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{payslipRunLabel(run)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="font-mono">{run.code}</span>, pay date {formatDate(run.payDate)},{" "}
                      {formatNumber(run.lines.length)} employees
                      {run.payslipsGeneratedAt ? `, generated ${formatDateTime(run.payslipsGeneratedAt)}` : ""}
                    </span>
                  </span>
                  <RunStatusBadge status={run.status} />
                </label>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={chosen.length === 0}
            onClick={() => {
              setOpen(false)
              onStart(chosen)
            }}
          >
            Generate {formatNumber(employees)} payslips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
