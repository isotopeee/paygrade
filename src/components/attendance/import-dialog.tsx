"use client"

import { useMemo, useRef, useState } from "react"
import { CheckIcon, CircleAlertIcon, CircleCheckIcon, FileSpreadsheetIcon, SparklesIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import type { PayrollPeriod } from "@/types"
import { DTR_CSV_HEADER, generateSampleDtrCsv, validateDtrCsv, type DtrImportRow } from "@/lib/attendance"
import { formatPeriod, fullName } from "@/lib/format"
import { dtrKey } from "@/lib/payroll/engine"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Step = 1 | 2 | 3

const STEP_LABELS: Record<Step, string> = { 1: "Upload", 2: "Preview and validate", 3: "Confirm" }

export function ImportDtrDialog({
  open,
  onOpenChange,
  period,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: PayrollPeriod
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import biometric logs</DialogTitle>
          <DialogDescription>
            Upload the DTR summary exported from the biometric system for {formatPeriod(period.start, period.end)}.
          </DialogDescription>
        </DialogHeader>
        <ImportFlow period={period} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Import progress">
      {([1, 2, 3] as const).map((s, i) => {
        const done = s < step
        const current = s === step
        return (
          <li key={s} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            {i > 0 && <span className="h-px w-6 bg-border" aria-hidden />}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[0.6875rem] font-medium tabular-nums",
                (done || current) && "border-foreground bg-foreground text-background"
              )}
            >
              {done ? <CheckIcon className="size-3" aria-hidden /> : s}
            </span>
            <span className={cn(current ? "font-medium" : "text-muted-foreground")}>{STEP_LABELS[s]}</span>
          </li>
        )
      })}
    </ol>
  )
}

function ImportFlow({ period, onDone }: { period: PayrollPeriod; onDone: () => void }) {
  const employees = useDataStore((s) => s.employees)
  const dtr = useDataStore((s) => s.dtr)
  const importDtr = useDataStore((s) => s.importDtr)

  const [step, setStep] = useState<Step>(1)
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [readError, setReadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const existingKeys = useMemo(
    () => new Set(dtr.filter((d) => d.periodId === period.id).map((d) => dtrKey(d.periodId, d.employeeId))),
    [dtr, period.id]
  )
  const result = useMemo(
    () => (csv ? validateDtrCsv(csv, { employees, period, existingKeys }) : null),
    [csv, employees, period, existingKeys]
  )

  const loadText = (text: string, name: string) => {
    setCsv(text)
    setFileName(name)
    setReadError(null)
    setStep(2)
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setReadError("Select a .csv file exported from the biometric system.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => loadText(typeof reader.result === "string" ? reader.result : "", file.name)
    reader.onerror = () => setReadError("The file could not be read. Try exporting it again.")
    reader.readAsText(file)
  }

  const loadSample = () => {
    const text = generateSampleDtrCsv({ employees, period, existingKeys })
    loadText(text, `zkteco-dtr-${period.start}-to-${period.end}.csv`)
  }

  const validRows = result?.rows.filter((r) => r.record) ?? []
  const label = `${formatPeriod(period.start, period.end)} (CSV import, ${validRows.length} employee${validRows.length === 1 ? "" : "s"})`

  const confirm = () => {
    const records = validRows.flatMap((r) => (r.record ? [r.record] : []))
    if (records.length === 0) return
    importDtr(records, label)
    toast.success("Biometric logs imported", {
      description: `${records.length} DTR records for ${formatPeriod(period.start, period.end)}. ${
        result?.invalidCount ? `${result.invalidCount} invalid rows skipped.` : ""
      }`.trim(),
    })
    onDone()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Stepper step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <FileSpreadsheetIcon className="size-8 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Select the DTR summary CSV</p>
              <p className="text-xs text-muted-foreground">One row per employee for the selected period.</p>
            </div>
            <input
              ref={fileInput}
              id="dtr-csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                onFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => fileInput.current?.click()}>
                <UploadIcon data-icon="inline-start" />
                Choose CSV file
              </Button>
              <Button type="button" variant="outline" onClick={loadSample}>
                <SparklesIcon data-icon="inline-start" />
                Use sample file
              </Button>
            </div>
            <label htmlFor="dtr-csv-file" className="sr-only">
              DTR CSV file
            </label>
            {readError && (
              <p role="alert" className="text-sm font-medium">
                {readError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium">Expected columns</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
              {DTR_CSV_HEADER}
              {"\n"}
              {`2015-0003,${period.start},${period.end},9,1,0,24,0,4,0,16`}
            </pre>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>Period dates must match the selected period ({period.start} to {period.end}).</li>
              <li>Days may be in half days. Minutes are whole numbers. Hours may have decimals.</li>
              <li>Days worked, leave, and absences cannot exceed the days required for the employee.</li>
              <li>Existing records for the same employee and period are overwritten.</li>
            </ul>
          </div>
        </div>
      )}

      {step === 2 && result && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono">{fileName}</span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="default" className="tabular-nums">
              {result.validCount} valid
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {result.invalidCount} invalid
            </Badge>
            <span className="text-muted-foreground tabular-nums">
              {result.createCount} new, {result.overwriteCount} overwrite
            </span>
          </div>
          {result.fileErrors.length > 0 ? (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>The file cannot be imported</AlertTitle>
              <AlertDescription>
                {result.fileErrors.map((e) => (
                  <span key={e} className="block">
                    {e}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          ) : (
            <PreviewTable rows={result.rows} />
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Records to import", value: result.validCount },
              { label: "New records", value: result.createCount },
              { label: "Overwritten records", value: result.overwriteCount },
              { label: "Rows skipped", value: result.invalidCount },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Only valid rows are imported with source <span className="font-medium text-foreground">Import</span>. The audit
            log will record this batch as <span className="font-medium text-foreground">{label}</span>.
          </p>
          {result.overwriteCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {result.overwriteCount} employee{result.overwriteCount === 1 ? " already has" : "s already have"} a DTR for this
              period. Their summaries will be replaced by the imported values.
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        {step === 1 && (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        )}
        {step === 2 && (
          <>
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" disabled={!result || result.validCount === 0} onClick={() => setStep(3)}>
              Continue with {result?.validCount ?? 0} valid row{result?.validCount === 1 ? "" : "s"}
            </Button>
          </>
        )}
        {step === 3 && (
          <>
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={confirm}>
              Import {result?.validCount ?? 0} record{result?.validCount === 1 ? "" : "s"}
            </Button>
          </>
        )}
      </DialogFooter>
    </div>
  )
}

function PreviewTable({ rows }: { rows: DtrImportRow[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
      <Table containerClassName="max-h-[45svh] overflow-auto" className="text-[0.8125rem]">
        <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-right">Line</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className="text-right">Worked</TableHead>
            <TableHead className="text-right">Leave</TableHead>
            <TableHead className="text-right">LWOP</TableHead>
            <TableHead className="text-right">Late</TableHead>
            <TableHead className="text-right">UT</TableHead>
            <TableHead className="text-right">OT</TableHead>
            <TableHead className="text-right">ND</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const valid = !!r.record
            const ot = [r.values.ot_regular_hours, r.values.ot_restday_hours].filter((v) => v && v !== "0").join(" + ")
            return (
              <TableRow key={r.line} className={cn(!valid && "bg-muted/40")}>
                <TableCell className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{r.line}</TableCell>
                <TableCell className="px-2 py-1.5">
                  <div className="font-mono text-xs">{r.employeeNo || "(blank)"}</div>
                  {r.employee && <div className="text-xs text-muted-foreground">{fullName(r.employee)}</div>}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{r.values.days_worked}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{r.values.leave_with_pay}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{r.values.absences}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{r.values.tardiness_min}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{r.values.undertime_min}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{ot || "0"}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tabular-nums">{r.values.night_diff_hours}</TableCell>
                <TableCell className="px-2 py-1.5">
                  {valid ? (
                    <span className={cn("text-xs", r.action === "overwrite" ? "font-medium" : "text-muted-foreground")}>
                      {r.action === "overwrite" ? "Overwrite" : "Create"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Skip</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  {valid ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <CircleCheckIcon className="size-3.5" aria-hidden />
                      Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-start gap-1 text-xs font-medium">
                      <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span className="whitespace-normal">{r.errors.join("; ")}</span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
