"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalculatorIcon,
  CheckIcon,
  ExternalLinkIcon,
  InfoIcon,
  SaveIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { Employee, EmployeeGroup, PayrollPeriod } from "@/types"
import { EMPLOYMENT_TYPE_SHORT, GROUP_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatPeriod, fullName } from "@/lib/format"
import {
  computeRegularLines,
  employeesForPeriod,
  findRunExceptions,
  scheduleForDate,
  type EngineData,
} from "@/lib/payroll/engine"
import { ratesForDate } from "@/lib/payroll/rates"
import { computeRunTotals } from "@/lib/payroll/totals"
import { can } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { PageContainer, PageHeader } from "@/components/page-header"
import { RunExceptionsPanel } from "@/components/payroll/run-exceptions"
import { RunStatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"

const STEPS = ["Period and group", "Employees", "Exceptions", "Review and compute"] as const

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" aria-label="Wizard progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
              i < step && "border-foreground bg-foreground text-background",
              i === step && "border-foreground ring-4 ring-foreground/10",
              i > step && "border-dashed text-muted-foreground"
            )}
          >
            {i < step ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-8 bg-border sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

export default function CreateRunPage() {
  const router = useRouter()
  const role = useRole()
  const runs = useDataStore((s) => s.runs)
  const periods = useDataStore((s) => s.periods)
  const departments = useDataStore((s) => s.departments)
  const employees = useDataStore((s) => s.employees)
  const dtr = useDataStore((s) => s.dtr)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const loans = useDataStore((s) => s.loans)
  const createRun = useDataStore((s) => s.createRun)

  const data: EngineData = useMemo(
    () => ({ employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods }),
    [employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods]
  )
  const candidatePeriods = useMemo(
    () => periods.filter((p) => p.start >= "2026-08-01" && p.start <= "2026-11-01"),
    [periods]
  )
  const existing = (periodId: string, group: EmployeeGroup) =>
    runs.find((r) => r.type === "regular" && r.periodId === periodId && r.group === group)

  const [initial] = useState(() => {
    for (const p of candidatePeriods)
      for (const g of ["plantilla", "jo_cos"] as EmployeeGroup[])
        if (!runs.some((r) => r.type === "regular" && r.periodId === p.id && r.group === g))
          return { periodId: p.id, group: g, payDate: p.payDate }
    const p = candidatePeriods[0]
    return { periodId: p?.id ?? "", group: "plantilla" as EmployeeGroup, payDate: p?.payDate ?? "" }
  })

  const [step, setStep] = useState(0)
  const [periodId, setPeriodId] = useState(initial.periodId)
  const [group, setGroup] = useState<EmployeeGroup>(initial.group)
  const [payDate, setPayDate] = useState(initial.payDate)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [acknowledged, setAcknowledged] = useState(false)
  const [note, setNote] = useState("")
  const [query, setQuery] = useState("")

  const period: PayrollPeriod | undefined = periods.find((p) => p.id === periodId)
  const clash = period ? existing(period.id, group) : undefined

  const eligible: Employee[] = useMemo(
    () => (period ? employeesForPeriod(employees, group, period.start, period.end) : []),
    [period, group, employees]
  )
  const included = useMemo(() => eligible.filter((e) => !excluded.has(e.id)), [eligible, excluded])
  const exceptions = useMemo(() => (period ? findRunExceptions(data, group, period) : null), [period, group, data])
  const preview = useMemo(() => {
    if (!period || step !== 3) return null
    const lines = computeRegularLines(
      data,
      { periodId: period.id, periodStart: period.start, employeeIds: included.map((e) => e.id) },
      []
    )
    return computeRunTotals(lines)
  }, [step, period, included, data])

  if (!can(role, "payroll.create")) {
    return (
      <PageContainer>
        <Alert>
          <ShieldAlertIcon aria-hidden />
          <AlertTitle>Only the HR Payroll Officer can create payroll runs</AlertTitle>
          <AlertDescription>
            Switch to the HR Payroll Officer role from the user menu to try the Create Run wizard.
          </AlertDescription>
        </Alert>
      </PageContainer>
    )
  }

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectPeriodGroup = (pid: string, g: EmployeeGroup) => {
    setPeriodId(pid)
    setGroup(g)
    setExcluded(new Set())
    setAcknowledged(false)
    setPayDate(periods.find((p) => p.id === pid)?.payDate ?? "")
  }

  const submit = (computeNow: boolean) => {
    if (!period) return
    const id = createRun({
      type: "regular",
      group,
      periodId: period.id,
      periodStart: period.start,
      periodEnd: period.end,
      payDate,
      employeeIds: included.map((e) => e.id),
      computeNow,
      note: note.trim() || undefined,
    })
    toast.success(computeNow ? "Payroll run created and computed" : "Draft payroll run created", {
      description: `${formatPeriod(period.start, period.end)}, ${GROUP_LABELS[group]}`,
    })
    router.push(`/payroll/${id}`)
  }

  const rates = period ? ratesForDate(ratesVersions, period.start) : null
  const schedule = period ? scheduleForDate(salarySchedules, period.start) : null
  const filtered = eligible.filter((e) =>
    `${fullName(e)} ${e.employeeNo} ${e.positionTitle}`.toLowerCase().includes(query.toLowerCase())
  )
  const canContinue = step === 0 ? !!period && !clash && !!payDate : step === 1 ? included.length > 0 : step === 2 ? acknowledged : true

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/payroll" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Payroll Runs
          </Link>
        }
        title="Create payroll run"
        description="Select the period and employee group, review exceptions, then compute."
      />
      <StepIndicator step={step} />

      <Card>
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>Payroll month</CardTitle>
              <CardDescription>One payroll period per calendar month. The pay date defaults to the last day of the month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Period</th>
                      <th className="px-3 py-2 text-left font-medium">Working days</th>
                      <th className="px-3 py-2 text-left font-medium">Plantilla</th>
                      <th className="px-3 py-2 text-left font-medium">JO/COS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {candidatePeriods.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{formatPeriod(p.start, p.end)}</div>
                          <div className="text-xs text-muted-foreground">Pay date {formatDate(p.payDate)}</div>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{p.workingDays}</td>
                        {(["plantilla", "jo_cos"] as EmployeeGroup[]).map((g) => {
                          const run = existing(p.id, g)
                          const selected = periodId === p.id && group === g
                          return (
                            <td key={g} className="px-3 py-2">
                              {run ? (
                                <Link
                                  href={`/payroll/${run.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs hover:underline"
                                >
                                  <RunStatusBadge status={run.status} />
                                  <ExternalLinkIcon className="size-3" aria-hidden />
                                  <span className="sr-only">Open existing run</span>
                                </Link>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={selected ? "default" : "outline"}
                                  onClick={() => selectPeriodGroup(p.id, g)}
                                  aria-pressed={selected}
                                >
                                  {selected && <CheckIcon data-icon="inline-start" aria-hidden />}
                                  {selected ? "Selected" : "Select"}
                                </Button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {clash && (
                <Alert>
                  <InfoIcon aria-hidden />
                  <AlertTitle>A run already exists for this period and group</AlertTitle>
                  <AlertDescription>
                    <Link href={`/payroll/${clash.id}`} className="underline">
                      Open {clash.code}
                    </Link>{" "}
                    instead of creating a duplicate.
                  </AlertDescription>
                </Alert>
              )}
              {period && !clash && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Selected</FieldLabel>
                    <div className="text-sm font-medium">
                      {formatPeriod(period.start, period.end)}, {GROUP_LABELS[group]}
                    </div>
                    <FieldDescription>{period.workingDays} working days</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pay-date">Pay date</FieldLabel>
                    <Input
                      id="pay-date"
                      type="date"
                      value={payDate}
                      min={period.start}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Rates and salary schedule</FieldLabel>
                    <div className="text-sm">{rates?.label}</div>
                    <FieldDescription>{schedule?.name}</FieldDescription>
                  </Field>
                </div>
              )}
            </CardContent>
          </>
        )}

        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
              <CardDescription>
                {included.length} of {eligible.length} {GROUP_LABELS[group]} employees in service during the period are included.
                Suspended employees are excluded automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="h-8 w-full sm:w-72">
                  <InputGroupAddon>
                    <SearchIcon aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter employees"
                    aria-label="Filter employees"
                  />
                </InputGroup>
                <Button variant="ghost" size="sm" onClick={() => setExcluded(new Set())}>
                  Include all
                </Button>
              </div>
              <div className="max-h-[50svh] overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-background text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <span className="sr-only">Include</span>
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Employee</th>
                      <th className="px-3 py-2 text-left font-medium">Position</th>
                      <th className="px-3 py-2 text-left font-medium">Department</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((e) => (
                      <tr key={e.id} className={cn(excluded.has(e.id) && "text-muted-foreground")}>
                        <td className="px-3 py-1.5">
                          <Checkbox
                            checked={!excluded.has(e.id)}
                            onCheckedChange={() => toggle(e.id)}
                            aria-label={`Include ${fullName(e)}`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="font-medium">{fullName(e)}</div>
                          <div className="font-mono text-xs text-muted-foreground">{e.employeeNo}</div>
                        </td>
                        <td className="px-3 py-1.5">{e.positionTitle}</td>
                        <td className="px-3 py-1.5">{departments.find((d) => d.id === e.departmentId)?.name}</td>
                        <td className="px-3 py-1.5">{EMPLOYMENT_TYPE_SHORT[e.employmentType]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </>
        )}

        {step === 2 && exceptions && (
          <>
            <CardHeader>
              <CardTitle>Review exceptions</CardTitle>
              <CardDescription>
                Employees who need attention before computing. Employees with missing DTR can be excluded here and paid in the
                next period once logs are complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RunExceptionsPanel
                exceptions={exceptions}
                departments={departments}
                excluded={excluded}
                onToggleExclude={toggle}
              />
              <Field orientation="horizontal" className="items-start rounded-lg border p-3">
                <Checkbox id="ack" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} />
                <FieldLabel htmlFor="ack" className="font-normal">
                  I have reviewed the exceptions and the treatment that will be applied to each employee.
                </FieldLabel>
              </Field>
            </CardContent>
          </>
        )}

        {step === 3 && period && (
          <>
            <CardHeader>
              <CardTitle>Review and compute</CardTitle>
              <CardDescription>Estimated totals from a dry run. Computing saves the run in Computed status for HR review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Period</dt>
                  <dd className="font-medium">{formatPeriod(period.start, period.end)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Group</dt>
                  <dd className="font-medium">{GROUP_LABELS[group]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Pay date</dt>
                  <dd className="font-medium">{formatDate(payDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Employees</dt>
                  <dd className="font-medium tabular-nums">
                    {included.length}
                    {excluded.size > 0 && <span className="text-muted-foreground"> ({excluded.size} excluded)</span>}
                  </dd>
                </div>
              </dl>
              {preview && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Estimated gross", preview.gross],
                    ["Estimated deductions", preview.totalDeductions],
                    ["Estimated net", preview.net],
                    ["Withholding tax", preview.withholdingTax],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="text-lg font-semibold tabular-nums">{formatCurrency(Number(value))}</div>
                    </div>
                  ))}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="run-note">Note for reviewers (optional)</FieldLabel>
                <Textarea
                  id="run-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For example: Includes step increments effective Sep 1 per NOSI dated Aug 20, 2026."
                />
              </Field>
            </CardContent>
          </>
        )}

        <CardFooter className="flex flex-wrap justify-between gap-2 border-t">
          <Button variant="outline" onClick={() => (step === 0 ? router.push("/payroll") : setStep(step - 1))}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>
              Continue
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => submit(false)}>
                <SaveIcon data-icon="inline-start" aria-hidden />
                Save as draft
              </Button>
              <Button onClick={() => submit(true)}>
                <CalculatorIcon data-icon="inline-start" aria-hidden />
                Create and compute
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </PageContainer>
  )
}
