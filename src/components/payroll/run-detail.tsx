"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowLeftIcon,
  CalculatorIcon,
  DownloadIcon,
  FileTextIcon,
  InfoIcon,
  LockIcon,
  PlusIcon,
  ReceiptTextIcon,
  Trash2Icon,
  TriangleAlertIcon,
  Undo2Icon,
  UserCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { PayrollLine, PayrollRun } from "@/types"
import { GROUP_LABELS, ROLE_LABELS, SPECIAL_KIND_BASIS } from "@/lib/constants"
import { formatCurrency, formatDate, formatDateTime, formatPeriod } from "@/lib/format"
import { findRunExceptions } from "@/lib/payroll/engine"
import { sumBy } from "@/lib/payroll/money"
import { canAdjust, canAdvance, currentOwner, isLocked } from "@/lib/workflow"
import { useMockExport } from "@/hooks/use-mock-export"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { DataTable, createColumns, DataTableColumnHeader } from "@/components/data-table"
import { Money } from "@/components/money"
import { PageContainer } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { RunStatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AdjustmentDialog } from "./adjustment-dialog"
import { LineSheet } from "./line-sheet"
import { regularRegisterColumns, specialRegisterColumns } from "./register-columns"
import { RunActivity } from "./run-activity"
import { RunExceptionsPanel } from "./run-exceptions"
import { WorkflowActions } from "./workflow-actions"
import { WorkflowStepper } from "./workflow-stepper"

export function RunNotFound({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <PageContainer>
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>Payroll run not found</EmptyTitle>
          <EmptyDescription>It may have been deleted, or the demo data was reset.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" render={<Link href={backHref} />}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            {backLabel}
          </Button>
        </EmptyContent>
      </Empty>
    </PageContainer>
  )
}

const adjCol = createColumns<PayrollRun["adjustments"][number] & { employeeName: string }>()

export function RunDetail({ run, backHref }: { run: PayrollRun; backHref: string }) {
  const router = useRouter()
  const role = useRole()
  const departments = useDataStore((s) => s.departments)
  const periods = useDataStore((s) => s.periods)
  const employees = useDataStore((s) => s.employees)
  const dtr = useDataStore((s) => s.dtr)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const loans = useDataStore((s) => s.loans)
  const computeRun = useDataStore((s) => s.computeRun)
  const deleteDraftRun = useDataStore((s) => s.deleteDraftRun)
  const exportFile = useMockExport()
  const [openEmployee, setOpenEmployee] = useState<string | null>(null)
  const [adjustFor, setAdjustFor] = useState<string | undefined>(undefined)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState("register")

  const isSpecial = run.type === "special"
  const period = run.periodId ? periods.find((p) => p.id === run.periodId) : undefined
  const owner = currentOwner(run.status)
  const mine = role ? canAdvance(run, role) : false
  const mayAdjust = role ? canAdjust(run, role) : false
  const lastReturn = [...run.comments].reverse().find((c) => c.kind === "return")
  const returnedIsLatest = lastReturn && run.history.at(-1)?.at === lastReturn.createdAt
  const exceptionsCount = run.lines.filter((l) => l.flags.length > 0).length
  const employerShare =
    run.totals.gsisGovernment + run.totals.ecc + run.totals.philhealthGovernment + run.totals.pagibigGovernment

  const columns = useMemo(() => {
    if (!isSpecial) return regularRegisterColumns(departments)
    const codes = new Map<string, string>()
    for (const l of run.lines) for (const a of l.allowances) codes.set(a.code, a.label)
    return specialRegisterColumns(
      departments,
      Array.from(codes.entries()).map(([code, label]) => ({ code, label }))
    )
  }, [isSpecial, departments, run.lines])

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(run.lines.map((l) => departments.find((d) => d.id === l.departmentId)?.name ?? l.departmentId)))
        .sort()
        .map((name) => ({ label: name, value: name })),
    [run.lines, departments]
  )

  const draftExceptions = useMemo(
    () =>
      run.status === "draft" && !isSpecial && period
        ? findRunExceptions(
            { employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods },
            run.group,
            period
          )
        : null,
    [run.status, isSpecial, period, run.group, employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods]
  )

  const byDepartment = useMemo(() => {
    const map = new Map<string, { name: string; headcount: number; gross: number; deductions: number; net: number; employer: number }>()
    for (const l of run.lines) {
      const name = departments.find((d) => d.id === l.departmentId)?.name ?? l.departmentId
      const row = map.get(name) ?? { name, headcount: 0, gross: 0, deductions: 0, net: 0, employer: 0 }
      row.headcount += 1
      row.gross += l.gross
      row.deductions += l.totalDeductions
      row.net += l.net
      row.employer += l.gsisGovernment + l.ecc + l.philhealthGovernment + l.pagibigGovernment
      map.set(name, row)
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [run.lines, departments])

  const adjustmentRows = useMemo(
    () =>
      run.adjustments.map((a) => ({
        ...a,
        employeeName: run.lines.find((l) => l.employeeId === a.employeeId)?.employeeName ?? a.employeeId,
      })),
    [run.adjustments, run.lines]
  )

  const adjustmentColumns = useMemo(
    () =>
      adjCol.columns([
        adjCol.accessor("employeeName", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
          meta: { label: "Employee" },
        }),
        adjCol.accessor("kind", {
          header: "Type",
          cell: ({ getValue }) => (
            <Badge variant={getValue() === "earning" ? "outline" : "secondary"}>
              {getValue() === "earning" ? "Earning" : "Deduction"}
            </Badge>
          ),
          meta: { label: "Type" },
        }),
        adjCol.accessor("label", { header: "Description", meta: { label: "Description" } }),
        adjCol.accessor("amount", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
          cell: ({ getValue }) => <Money value={getValue()} />,
          meta: { numeric: true, label: "Amount" },
        }),
        adjCol.accessor("reason", {
          header: "Reason",
          cell: ({ getValue }) => <span className="line-clamp-2 max-w-md text-xs whitespace-normal text-muted-foreground">{getValue()}</span>,
          meta: { label: "Reason" },
        }),
        adjCol.accessor("createdBy", {
          header: "Added by",
          cell: ({ row }) => (
            <div className="text-xs">
              <div>{row.original.createdBy}</div>
              <div className="text-muted-foreground tabular-nums">{formatDateTime(row.original.createdAt)}</div>
            </div>
          ),
          meta: { label: "Added by" },
        }),
      ]),
    []
  )

  const flagged = run.lines.filter((l) => l.flags.length > 0)
  const fileStem = `payroll-register-${run.code}`

  const openAdjust = (employeeId?: string) => {
    setAdjustFor(employeeId)
    setAdjustOpen(true)
  }

  return (
    <PageContainer className="gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href={backHref} className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeftIcon className="size-3.5" aria-hidden />
              {isSpecial ? "Special Payroll" : "Payroll Runs"}
            </Link>
            <span aria-hidden>/</span>
            <span className="font-mono">{run.code}</span>
          </div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            {isSpecial ? run.title : formatPeriod(run.periodStart, run.periodEnd)}
            <RunStatusBadge status={run.status} />
            {run.locked && (
              <Badge variant="outline" className="gap-1">
                <LockIcon data-icon="inline-start" aria-hidden />
                Locked
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSpecial ? `Special payroll, ${GROUP_LABELS[run.group]}` : run.title}
            {" · "}Pay date {formatDate(run.payDate)}
            {" · "}Created by {run.createdBy}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {run.status !== "draft" && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <DownloadIcon data-icon="inline-start" aria-hidden />
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Mock exports</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      exportFile({ title: "Payroll Register", format: "PDF", fileStem, entityId: run.id, rows: run.lines.length })
                    }
                  >
                    Payroll Register (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      exportFile({ title: "Payroll Register", format: "Excel", fileStem, entityId: run.id, rows: run.lines.length })
                    }
                  >
                    Payroll Register (Excel)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      exportFile({
                        title: "General Payroll",
                        format: "PDF",
                        fileStem: `general-payroll-${run.code}`,
                        entityId: run.id,
                        rows: run.lines.length,
                      })
                    }
                  >
                    General Payroll form (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      exportFile({
                        title: "Landbank ATM credit file",
                        format: "CSV",
                        fileStem: `lbp-payroll-credit-${run.code}`,
                        entityId: run.id,
                        rows: run.lines.length,
                      })
                    }
                  >
                    Landbank ATM credit file (CSV)
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                {isLocked(run.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push(`/payslips?run=${run.id}`)}>
                      <ReceiptTextIcon aria-hidden />
                      Open payslips
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {run.status === "draft" && role === "hr" && (
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon data-icon="inline-start" aria-hidden />
              Delete draft
            </Button>
          )}
          {mayAdjust && (
            <Button variant="outline" onClick={() => openAdjust()}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              Adjustment
            </Button>
          )}
          <WorkflowActions run={run} />
        </div>
      </div>

      {/* Workflow */}
      <Card size="sm">
        <CardContent className="space-y-4">
          <WorkflowStepper run={run} />
          {owner && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
              <UserCheckIcon className="size-4" aria-hidden />
              {mine ? (
                <span className="font-medium text-foreground">This run is waiting on you ({ROLE_LABELS[owner]}).</span>
              ) : (
                <span>
                  Waiting on the <span className="font-medium text-foreground">{ROLE_LABELS[owner]}</span>. Switch roles from
                  the user menu to act on this step.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {run.locked && (
        <Alert>
          <LockIcon aria-hidden />
          <AlertTitle>Locked after approval</AlertTitle>
          <AlertDescription>
            Approved on {formatDateTime(run.history.find((h) => h.status === "approved")?.at ?? run.createdAt)}. The
            register can no longer be edited or returned. Corrections go through an adjustment in the next payroll period.
          </AlertDescription>
        </Alert>
      )}

      {returnedIsLatest && lastReturn && (
        <Alert>
          <Undo2Icon aria-hidden />
          <AlertTitle>
            Returned by {lastReturn.author} ({ROLE_LABELS[lastReturn.role]})
          </AlertTitle>
          <AlertDescription>{lastReturn.body}</AlertDescription>
        </Alert>
      )}

      {isSpecial && run.specialKind && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {SPECIAL_KIND_BASIS[run.specialKind]}
        </p>
      )}

      {run.status === "draft" ? (
        <Card>
          <CardHeader>
            <CardTitle>Pre-computation review</CardTitle>
            <CardDescription>
              {run.employeeIds.length} employees are included. Review the exceptions below, then compute the payroll.
              {role !== "hr" && " Only the HR Payroll Officer can compute."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftExceptions ? (
              <RunExceptionsPanel exceptions={draftExceptions} departments={departments} />
            ) : (
              <p className="text-sm text-muted-foreground">Eligibility was checked when the run was created.</p>
            )}
            {role === "hr" && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <Button
                  onClick={() => {
                    computeRun(run.id)
                    const after = useDataStore.getState().runs.find((r) => r.id === run.id)
                    toast.success("Payroll computed", {
                      description: after ? `${after.totals.headcount} employees, net pay ${formatCurrency(after.totals.net)}` : undefined,
                    })
                  }}
                >
                  <CalculatorIcon data-icon="inline-start" aria-hidden />
                  Compute payroll
                </Button>
                <span className="text-xs text-muted-foreground">
                  Uses the rates version and salary schedule in force on {formatDate(run.periodStart)}.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Employees" value={run.totals.headcount} hint={GROUP_LABELS[run.group]} />
            <StatCard label="Gross pay" value={formatCurrency(run.totals.gross)} />
            <StatCard label="Total deductions" value={formatCurrency(run.totals.totalDeductions)} hint={`W/Tax ${formatCurrency(run.totals.withholdingTax)}`} />
            <StatCard label="Net pay" value={formatCurrency(run.totals.net)} hint="Credited via Landbank ATM" />
            <StatCard
              label="Government share"
              value={formatCurrency(employerShare)}
              hint="GSIS, ECC, PhilHealth, Pag-IBIG"
              className="col-span-2 md:col-span-1"
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="exceptions">
                Exceptions
                {exceptionsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 tabular-nums">
                    {exceptionsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="adjustments">
                Adjustments
                {run.adjustments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 tabular-nums">
                    {run.adjustments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="activity">
                Activity
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 tabular-nums">
                  {run.comments.filter((c) => c.kind !== "transition" || c.body).length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="mt-3">
              <DataTable<PayrollLine>
                columns={columns}
                data={run.lines}
                getRowId={(l) => l.employeeId}
                searchPlaceholder="Search name or employee no."
                filters={[
                  { columnId: "department", title: "Department", options: departmentOptions },
                  {
                    columnId: "exceptions",
                    title: "Notes",
                    options: [
                      { label: "With notes", value: "With notes", icon: TriangleAlertIcon },
                      { label: "No notes", value: "No notes" },
                    ],
                  },
                ]}
                initialVisibility={{
                  department: false,
                  exceptions: false,
                  group: false,
                  monthlyRate: false,
                  gsisGovernment: false,
                  philhealthGovernment: false,
                  pagibigGovernment: false,
                }}
                onRowClick={(l) => setOpenEmployee(l.employeeId)}
                rowLabel={(l) => `Open computation breakdown for ${l.employeeName}`}
                activeRowId={openEmployee ?? undefined}
                showFooter
                dense
                pageSize={50}
                maxHeightClassName="max-h-[calc(100svh-22rem)] min-h-80"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Click a row to open the computation breakdown. Amounts are in Philippine pesos.
              </p>
            </TabsContent>

            <TabsContent value="exceptions" className="mt-3">
              {flagged.length === 0 ? (
                <Empty className="border py-12">
                  <EmptyHeader>
                    <EmptyTitle>No computation notes</EmptyTitle>
                    <EmptyDescription>Every employee was computed from a complete DTR with no special handling.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {flagged.map((l) => (
                    <li key={l.employeeId}>
                      <button
                        type="button"
                        onClick={() => setOpenEmployee(l.employeeId)}
                        className="flex w-full flex-wrap items-start gap-x-4 gap-y-1 px-3 py-2.5 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <span className="w-56 min-w-0">
                          <span className="block truncate font-medium">{l.employeeName}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{l.employeeNo}</span>
                        </span>
                        <ul className="min-w-0 flex-1 space-y-0.5 text-xs text-muted-foreground">
                          {l.flags.map((f) => (
                            <li key={f} className="flex gap-1.5">
                              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <span className="text-right tabular-nums">
                          <span className="block text-xs text-muted-foreground">Net</span>
                          {formatCurrency(l.net)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="adjustments" className="mt-3 space-y-3">
              {mayAdjust && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => openAdjust()}>
                    <PlusIcon data-icon="inline-start" aria-hidden />
                    Add adjustment
                  </Button>
                </div>
              )}
              <DataTable
                columns={adjustmentColumns}
                data={adjustmentRows}
                getRowId={(a) => a.id}
                onRowClick={(a) => setOpenEmployee(a.employeeId)}
                hidePagination
                maxHeightClassName="max-h-[60svh]"
                emptyState={{
                  icon: <PlusIcon />,
                  title: "No manual adjustments",
                  description: mayAdjust
                    ? "Add an earning or deduction with a reason. It is recomputed and logged to the audit trail."
                    : "Adjustments can be added by the HR Payroll Officer while the run is in Computed status.",
                }}
              />
            </TabsContent>

            <TabsContent value="summary" className="mt-3">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm">By department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-1.5 text-left font-medium">Department</th>
                          <th className="py-1.5 text-right font-medium">Heads</th>
                          <th className="py-1.5 text-right font-medium">Gross</th>
                          <th className="py-1.5 text-right font-medium">Net</th>
                          <th className="hidden py-1.5 text-right font-medium sm:table-cell">Gov share</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {byDepartment.map((d) => (
                          <tr key={d.name} className="border-b border-dashed last:border-0">
                            <td className="py-1.5">{d.name}</td>
                            <td className="py-1.5 text-right">{d.headcount}</td>
                            <td className="py-1.5 text-right">{formatCurrency(d.gross)}</td>
                            <td className="py-1.5 text-right">{formatCurrency(d.net)}</td>
                            <td className="hidden py-1.5 text-right sm:table-cell">{formatCurrency(d.employer)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="font-medium tabular-nums">
                        <tr className="border-t">
                          <td className="py-1.5">Total</td>
                          <td className="py-1.5 text-right">{run.totals.headcount}</td>
                          <td className="py-1.5 text-right">{formatCurrency(run.totals.gross)}</td>
                          <td className="py-1.5 text-right">{formatCurrency(run.totals.net)}</td>
                          <td className="hidden py-1.5 text-right sm:table-cell">{formatCurrency(employerShare)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm">Remittances generated</CardTitle>
                    <CardDescription>Employee and government shares from this run</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-1.5 text-left font-medium">Agency</th>
                          <th className="py-1.5 text-right font-medium">Employee</th>
                          <th className="py-1.5 text-right font-medium">Government</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {[
                          ["GSIS (incl. ECC)", run.totals.gsis, run.totals.gsisGovernment + run.totals.ecc],
                          ["PhilHealth", run.totals.philhealth, run.totals.philhealthGovernment],
                          ["Pag-IBIG", run.totals.pagibig, run.totals.pagibigGovernment],
                          ["BIR withholding tax", run.totals.withholdingTax, 0],
                          ["Loan amortizations", run.totals.loans, 0],
                        ].map(([label, ee, er]) => (
                          <tr key={String(label)} className="border-b border-dashed last:border-0">
                            <td className="py-1.5">{label}</td>
                            <td className="py-1.5 text-right">{formatCurrency(Number(ee))}</td>
                            <td className="py-1.5 text-right">{Number(er) === 0 ? <span className="text-muted-foreground">None</span> : formatCurrency(Number(er))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="font-medium tabular-nums">
                        <tr className="border-t">
                          <td className="py-1.5">Total</td>
                          <td className="py-1.5 text-right">
                            {formatCurrency(run.totals.gsis + run.totals.philhealth + run.totals.pagibig + run.totals.withholdingTax + run.totals.loans)}
                          </td>
                          <td className="py-1.5 text-right">{formatCurrency(employerShare)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Other deductions from manual adjustments: {formatCurrency(sumBy(run.lines, (l) => l.otherDeductionsTotal))}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-3">
              <RunActivity run={run} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <LineSheet
        run={run}
        employeeId={openEmployee}
        onOpenChange={(o) => !o && setOpenEmployee(null)}
        onNavigate={setOpenEmployee}
        onAddAdjustment={(id) => openAdjust(id)}
      />
      <AdjustmentDialog run={run} open={adjustOpen} onOpenChange={setAdjustOpen} employeeId={adjustFor} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft run?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft for {isSpecial ? run.title : formatPeriod(run.periodStart, run.periodEnd)} will be removed. You
              can create it again from the Create Run wizard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteDraftRun(run.id)
                setConfirmDelete(false)
                toast.success("Draft deleted")
                router.push(backHref)
              }}
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
