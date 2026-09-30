"use client"

import * as React from "react"
import { CircleCheckBigIcon, FileTextIcon } from "lucide-react"
import { toast } from "sonner"

import type { PayrollRun } from "@/types"
import { formatNumber } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"

import { payslipRunLabel } from "./run-label"

const DURATION_MS = 1500

/**
 * Simulated payslip generation. Mount it when a job starts: the progress bar
 * ticks through every employee in the selected runs over about 1.5 seconds,
 * then the runs are stamped with `generatePayslips`.
 */
export function GeneratePayslipsDialog({ runs, onClose }: { runs: PayrollRun[]; onClose: () => void }) {
  const generatePayslips = useDataStore((s) => s.generatePayslips)
  const [open, setOpen] = React.useState(true)
  const [progress, setProgress] = React.useState(0)
  const [done, setDone] = React.useState(false)

  // Snapshot the job at mount so later store updates do not restart it.
  const [job] = React.useState(() => ({
    ids: runs.map((r) => r.id),
    names: runs.flatMap((r) => r.lines.map((l) => l.employeeName)),
    label: runs.length === 1 && runs[0] ? runs[0].code : `${runs.length} payroll runs`,
  }))
  const total = job.names.length

  React.useEffect(() => {
    const started = performance.now()
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (performance.now() - started) / DURATION_MS)
      setProgress(ratio)
      if (ratio >= 1) {
        window.clearInterval(timer)
        generatePayslips(job.ids)
        setDone(true)
        toast.success("Payslips generated", {
          description: `${formatNumber(job.names.length)} payslips for ${job.label}.`,
        })
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [generatePayslips, job])

  const processed = Math.min(total, Math.floor(progress * total))
  const currentName = job.names[Math.min(total - 1, processed)] ?? ""

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !done) return
        setOpen(next)
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent showCloseButton={done} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{done ? "Payslips generated" : "Generating payslips"}</DialogTitle>
          <DialogDescription>
            {runs.length === 1 && runs[0]
              ? `${runs[0].code}, ${payslipRunLabel(runs[0])}`
              : `${runs.length} payroll runs, ${formatNumber(total)} employees`}
          </DialogDescription>
        </DialogHeader>

        <Progress value={Math.round(progress * 100)} aria-label="Payslip generation progress">
          <ProgressLabel className="text-xs font-normal text-muted-foreground">
            {formatNumber(processed)} of {formatNumber(total)} employees
          </ProgressLabel>
          <ProgressValue className="text-xs">{(_, value) => `${value ?? 0}%`}</ProgressValue>
        </Progress>

        <div className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs" aria-live="polite">
          {done ? (
            <>
              <CircleCheckBigIcon className="size-4 shrink-0" aria-hidden />
              <span>All payslips are ready for download and printing.</span>
            </>
          ) : (
            <>
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">Rendering payslip for {currentName}</span>
            </>
          )}
        </div>

        <DialogFooter>
          <Button disabled={!done} onClick={() => setOpen(false)}>
            {done ? "Done" : "Please wait"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
