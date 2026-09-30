"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  InfoIcon,
  PlusIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import type { LineItem, PayrollRun } from "@/types"
import { formatCurrency, formatDateTime, formatHours, formatMinutes, formatPercent } from "@/lib/format"
import { dtrKey } from "@/lib/payroll/engine"
import { ratesForDate } from "@/lib/payroll/rates"
import { canAdjust } from "@/lib/workflow"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

function Row({
  label,
  value,
  negative = false,
  strong = false,
  hint,
  indent = false,
}: {
  label: React.ReactNode
  value: number
  negative?: boolean
  strong?: boolean
  hint?: React.ReactNode
  indent?: boolean
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "font-semibold")}>
      <div className={cn("min-w-0", indent && "pl-3")}>
        <div className={cn(!strong && "text-foreground/90")}>{label}</div>
        {hint && <div className="text-xs font-normal text-muted-foreground">{hint}</div>}
      </div>
      <div className={cn("shrink-0 tabular-nums", value === 0 && !strong && "text-muted-foreground/60")}>
        {negative && value !== 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}
      </div>
    </div>
  )
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      <div className="divide-y divide-dashed">{children}</div>
    </section>
  )
}

function items(list: LineItem[]) {
  return list.map((i) => <Row key={i.code + i.label} label={i.label} value={i.amount} indent />)
}

export function LineSheet({
  run,
  employeeId,
  onOpenChange,
  onNavigate,
  onAddAdjustment,
}: {
  run: PayrollRun
  employeeId: string | null
  onOpenChange: (open: boolean) => void
  onNavigate: (employeeId: string) => void
  onAddAdjustment: (employeeId: string) => void
}) {
  const role = useRole()
  const dtr = useDataStore((s) => s.dtr)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const departments = useDataStore((s) => s.departments)
  const employees = useDataStore((s) => s.employees)
  const removeAdjustment = useDataStore((s) => s.removeAdjustment)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState("")
  const [removeError, setRemoveError] = useState<string | null>(null)

  const index = run.lines.findIndex((l) => l.employeeId === employeeId)
  const line = index >= 0 ? run.lines[index] : undefined
  const prev = index > 0 ? run.lines[index - 1] : undefined
  const next = index >= 0 && index < run.lines.length - 1 ? run.lines[index + 1] : undefined
  const employee = employees.find((e) => e.id === employeeId)
  const rates = useMemo(() => ratesForDate(ratesVersions, run.periodStart), [ratesVersions, run.periodStart])
  const record = run.periodId && employeeId ? dtr.find((d) => dtrKey(d.periodId, d.employeeId) === dtrKey(run.periodId ?? "", employeeId)) : undefined
  const adjustments = run.adjustments.filter((a) => a.employeeId === employeeId)
  const mayAdjust = role ? canAdjust(run, role) : false
  const isSpecial = run.type === "special"

  const bracket = line
    ? rates.withholding.monthly.find(
        (b) => line.taxableIncome > b.over && (b.upTo === null || line.taxableIncome <= b.upTo)
      )
    : undefined

  const confirmRemove = () => {
    if (!removing) return
    if (removeReason.trim().length < 10) {
      setRemoveError("Give a reason of at least 10 characters.")
      return
    }
    removeAdjustment(run.id, removing, removeReason.trim())
    toast.success("Adjustment removed and payroll recomputed")
    setRemoving(null)
  }

  return (
    <>
      <Sheet open={!!employeeId && !!line} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
          {line ? (
            <>
              <SheetHeader className="gap-1 border-b p-4 pr-12">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{line.employeeNo}</span>
                  <span aria-hidden>·</span>
                  <span>{departments.find((d) => d.id === line.departmentId)?.name}</span>
                </div>
                <SheetTitle className="text-base">{line.employeeName}</SheetTitle>
                <SheetDescription>
                  {line.positionTitle}
                  {employee?.salaryGrade ? `, SG ${employee.salaryGrade} Step ${employee.step}` : ""}. Monthly rate{" "}
                  <span className="text-foreground tabular-nums">{formatCurrency(line.monthlyRate)}</span>
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => prev && onNavigate(prev.employeeId)}
                    disabled={!prev}
                    aria-label="Previous employee"
                  >
                    <ChevronLeftIcon aria-hidden />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => next && onNavigate(next.employeeId)}
                    disabled={!next}
                    aria-label="Next employee"
                  >
                    Next
                    <ChevronRightIcon aria-hidden />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {index + 1} of {run.lines.length}
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    <Button variant="ghost" size="xs" render={<Link href={`/employees/${line.employeeId}`} />}>
                      Profile
                      <ExternalLinkIcon aria-hidden />
                    </Button>
                    {run.status !== "draft" && (
                      <Button variant="ghost" size="xs" render={<Link href={`/payslips/${run.id}/${line.employeeId}`} />}>
                        <ReceiptTextIcon aria-hidden />
                        Payslip
                      </Button>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-6 p-4">
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Gross</div>
                      <div className="font-medium tabular-nums">{formatCurrency(line.gross)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Deductions</div>
                      <div className="font-medium tabular-nums">{formatCurrency(line.totalDeductions)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Net pay</div>
                      <div className="text-lg font-semibold tabular-nums">{formatCurrency(line.net)}</div>
                    </div>
                  </div>

                  {line.flags.length > 0 && (
                    <ul className="space-y-1.5 rounded-lg border border-dashed p-3 text-sm" aria-label="Computation notes">
                      {line.flags.map((f) => (
                        <li key={f} className="flex gap-2">
                          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!isSpecial && (
                    <Section title="Attendance used">
                      {record ? (
                        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 py-2 text-sm">
                          {[
                            ["Days required", record.daysRequired],
                            ["Days worked", record.daysWorked],
                            ["Leave with pay", record.leaveWithPayDays],
                            ["Absences (LWOP)", record.absencesWithoutPay],
                            ["Tardiness", formatMinutes(record.tardinessMinutes)],
                            ["Undertime", formatMinutes(record.undertimeMinutes)],
                            ["OT, regular", `${formatHours(record.overtimeHoursRegular)} h`],
                            ["OT, rest day", `${formatHours(record.overtimeHoursRestDay)} h`],
                            ["Night diff", `${formatHours(record.nightDiffHours)} h`],
                          ].map(([label, value]) => (
                            <div key={String(label)}>
                              <dt className="text-xs text-muted-foreground">{label}</dt>
                              <dd className="tabular-nums">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="py-2 text-sm text-muted-foreground">
                          No DTR on file for this period. Computed as full attendance.
                        </p>
                      )}
                    </Section>
                  )}

                  <Section title="Earnings">
                    {isSpecial ? (
                      items(line.allowances)
                    ) : (
                      <>
                        <Row
                          label="Basic salary"
                          value={line.basicScheduled}
                          hint={
                            line.notes.find((n) => n.startsWith("Prorated")) ??
                            (line.group === "plantilla"
                              ? "Monthly basic salary"
                              : "Contract rate times days required")
                          }
                        />
                        <Row
                          label="Less tardiness and undertime"
                          value={line.tardinessUndertime}
                          negative
                          indent
                          hint={`Per-minute rate: monthly ÷ ${rates.workingDaysPerMonth} days ÷ ${rates.hoursPerDay} hours ÷ 60`}
                        />
                        <Row
                          label="Less absences without pay"
                          value={line.absences}
                          negative
                          indent
                          hint={`Daily rate: ${line.group === "plantilla" ? `monthly ÷ ${rates.workingDaysPerMonth}` : "contract daily rate"}`}
                        />
                        <Row label="Basic salary earned" value={line.basic} strong />
                        <Row label="PERA" value={line.pera} hint={line.group === "plantilla" ? `${formatCurrency(rates.peraMonthly)} a month, prorated for days not in service` : "Not applicable to JO/COS"} />
                        {items(line.allowances)}
                        <Row
                          label="Overtime"
                          value={line.overtime}
                          hint={`${rates.overtime.regularDayMultiplier * 100}% regular days, ${rates.overtime.restDayMultiplier * 100}% rest days and holidays`}
                        />
                        <Row
                          label="Night differential"
                          value={line.nightDiff}
                          hint={`${formatPercent(rates.nightDiff.rate)} of the hourly rate, SG ${rates.nightDiff.maxSalaryGrade} and below`}
                        />
                      </>
                    )}
                    {line.otherEarnings.map((e) => (
                      <Row key={e.code} label={<span className="flex items-center gap-1.5">{e.label} <Badge variant="outline" className="h-4 px-1 text-[10px]">Manual</Badge></span>} value={e.amount} indent />
                    ))}
                    <Row label="Gross pay" value={line.gross} strong />
                  </Section>

                  <Section title="Deductions">
                    {!isSpecial && (
                      <>
                        <Row
                          label="GSIS personal share"
                          value={line.gsis}
                          hint={line.group === "plantilla" ? `${formatPercent(rates.gsis.personalRate)} of basic salary earned` : "JO/COS are not GSIS members"}
                        />
                        <Row
                          label="PhilHealth"
                          value={line.philhealth}
                          hint={`${formatPercent(rates.philhealth.premiumRate)} of monthly basic (${formatCurrency(rates.philhealth.floor)} floor, ${formatCurrency(rates.philhealth.ceiling)} ceiling), employee half`}
                        />
                        <Row
                          label="Pag-IBIG"
                          value={line.pagibig}
                          hint={`${formatPercent(rates.pagibig.employeeRate)} of up to ${formatCurrency(rates.pagibig.maxFundSalary)}`}
                        />
                        <Row
                          label="Withholding tax"
                          value={line.withholdingTax}
                          hint={
                            line.group === "plantilla"
                              ? `Taxable ${formatCurrency(line.taxableIncome)}. ${
                                  bracket && bracket.rate > 0
                                    ? `Monthly table: ${formatCurrency(bracket.baseTax)} plus ${formatPercent(bracket.rate)} of excess over ${formatCurrency(bracket.over)}`
                                    : "Within the zero-tax bracket"
                                }`
                              : line.notes.find((n) => n.includes("declaration") || n.includes("withholding"))
                          }
                        />
                        {items(line.loans)}
                      </>
                    )}
                    {line.otherDeductions.map((d) => (
                      <Row key={d.code} label={<span className="flex items-center gap-1.5">{d.label} <Badge variant="outline" className="h-4 px-1 text-[10px]">Manual</Badge></span>} value={d.amount} indent />
                    ))}
                    <Row label="Total deductions" value={line.totalDeductions} strong />
                  </Section>

                  <div className="flex items-baseline justify-between rounded-lg bg-foreground px-3 py-2.5 text-background">
                    <span className="text-sm font-medium">Net pay</span>
                    <span className="text-lg font-semibold tabular-nums">{formatCurrency(line.net)}</span>
                  </div>

                  {!isSpecial && line.group === "plantilla" && (
                    <Section title="Government share (not deducted)">
                      <Row label="GSIS government share" value={line.gsisGovernment} hint={`${formatPercent(rates.gsis.governmentRate)} of basic salary earned`} />
                      <Row label="Employees' Compensation (ECC)" value={line.ecc} />
                      <Row label="PhilHealth government share" value={line.philhealthGovernment} />
                      <Row label="Pag-IBIG government share" value={line.pagibigGovernment} />
                    </Section>
                  )}

                  <Section
                    title="Manual adjustments"
                    aside={
                      mayAdjust ? (
                        <Button size="xs" variant="outline" onClick={() => onAddAdjustment(line.employeeId)}>
                          <PlusIcon aria-hidden />
                          Add adjustment
                        </Button>
                      ) : undefined
                    }
                  >
                    {adjustments.length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground">
                        No manual adjustments.{" "}
                        {!mayAdjust && run.status !== "draft" && "Adjustments are allowed only while HR holds a computed run."}
                      </p>
                    ) : (
                      adjustments.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={a.kind === "earning" ? "outline" : "secondary"}>
                                {a.kind === "earning" ? "Earning" : "Deduction"}
                              </Badge>
                              <span className="truncate font-medium">{a.label}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {a.createdBy}, {formatDateTime(a.createdAt)}
                            </p>
                          </div>
                          <div className="tabular-nums">{formatCurrency(a.amount)}</div>
                          {mayAdjust && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove adjustment ${a.label}`}
                              onClick={() => {
                                setRemoving(a.id)
                                setRemoveReason("")
                                setRemoveError(null)
                              }}
                            >
                              <Trash2Icon aria-hidden />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </Section>

                  {line.notes.length > 0 && (
                    <Section title="Computation notes">
                      <ul className="space-y-1 py-2 text-xs text-muted-foreground">
                        {line.notes.map((n) => (
                          <li key={n} className="flex gap-1.5">
                            <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                            {n}
                          </li>
                        ))}
                        <li className="flex gap-1.5">
                          <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                          Rates version: {rates.label} (effective {rates.effectivityDate}).
                        </li>
                      </ul>
                    </Section>
                  )}
                </div>
              </ScrollArea>
              <Separator />
            </>
          ) : (
            <SheetHeader>
              <SheetTitle>Employee not in this run</SheetTitle>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove adjustment</DialogTitle>
            <DialogDescription>The line is recomputed without this adjustment. The removal is logged.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={removeError ? true : undefined}>
            <FieldLabel htmlFor="remove-reason">Reason for removal</FieldLabel>
            <Textarea
              id="remove-reason"
              rows={3}
              value={removeReason}
              onChange={(e) => {
                setRemoveReason(e.target.value)
                setRemoveError(null)
              }}
              aria-invalid={removeError ? true : undefined}
            />
            {removeError && <FieldError>{removeError}</FieldError>}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRemove}>Remove adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
