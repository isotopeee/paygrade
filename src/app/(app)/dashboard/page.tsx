"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { differenceInCalendarDays, parseISO } from "date-fns"
import {
  ArrowRightIcon,
  BanknoteIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  CircleCheckBigIcon,
  HandCoinsIcon,
  InboxIcon,
  TableIcon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import type { EmployeeGroup, PayrollRun, RunTotals } from "@/types"
import { AGENCY_LABELS, GROUP_LABELS, HOSPITAL, ROLE_LABELS, groupOf } from "@/lib/constants"
import { formatCurrency, formatDate, formatDateTime, formatMonth, formatPeriod, formatPeriodShort } from "@/lib/format"
import { computeRegularLines, employeesForPeriod, type EngineData } from "@/lib/payroll/engine"
import { computeRunTotals } from "@/lib/payroll/totals"
import { deriveRemittances, pendingForRole } from "@/lib/selectors"
import { nextStep } from "@/lib/workflow"
import { useDataStore } from "@/stores/data-store"
import { useCurrentUser } from "@/stores/session-store"
import { CURRENT_PERIOD_ID, DEMO_TODAY } from "@/data/seed"
import { NetTrendChart, type TrendPoint } from "@/components/dashboard/net-trend-chart"
import { PageContainer, PageHeader } from "@/components/page-header"
import { WorkflowStepper } from "@/components/payroll/workflow-stepper"
import { StatCard } from "@/components/stat-card"
import { RemittanceStatusBadge, RunStatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const GROUPS: EmployeeGroup[] = ["plantilla", "jo_cos"]

function runHref(r: PayrollRun) {
  return r.type === "special" ? `/special-payroll/${r.id}` : `/payroll/${r.id}`
}

export default function DashboardPage() {
  const user = useCurrentUser()
  const runs = useDataStore((s) => s.runs)
  const employees = useDataStore((s) => s.employees)
  const dtr = useDataStore((s) => s.dtr)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const loans = useDataStore((s) => s.loans)
  const periods = useDataStore((s) => s.periods)
  const audit = useDataStore((s) => s.audit)
  const filings = useDataStore((s) => s.remittanceFilings)
  const [view, setView] = useState<"chart" | "table">("chart")

  const period = periods.find((p) => p.id === CURRENT_PERIOD_ID)

  // Current period: actual totals where a run is computed, otherwise a dry-run projection.
  const current = useMemo(() => {
    if (!period) return null
    const data: EngineData = { employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods }
    const byGroup = GROUPS.map((group) => {
      const run = runs.find((r) => r.type === "regular" && r.periodId === period.id && r.group === group)
      if (run && run.lines.length > 0) return { group, run, totals: run.totals, projected: false }
      const ids = employeesForPeriod(employees, group, period.start, period.end).map((e) => e.id)
      const totals = computeRunTotals(computeRegularLines(data, { periodId: period.id, periodStart: period.start, employeeIds: ids }, []))
      return { group, run, totals, projected: true }
    })
    const sum = (k: keyof RunTotals) => byGroup.reduce((n, g) => n + g.totals[k], 0)
    return { byGroup, gross: sum("gross"), net: sum("net"), deductions: sum("totalDeductions") }
  }, [period, runs, employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods])

  const headcount = useMemo(() => {
    const active = employees.filter((e) => e.status !== "separated" || (e.separationDate ?? "") >= DEMO_TODAY)
    return {
      plantilla: active.filter((e) => groupOf(e.employmentType) === "plantilla").length,
      jo_cos: active.filter((e) => groupOf(e.employmentType) === "jo_cos").length,
    }
  }, [employees])

  const trend: TrendPoint[] = useMemo(() => {
    const map = new Map<string, TrendPoint>()
    for (const r of runs) {
      if (r.type !== "regular" || r.status === "draft" || !r.periodId) continue
      const p = map.get(r.periodId) ?? { label: formatPeriodShort(r.periodStart), start: r.periodStart, end: r.periodEnd, plantilla: 0, jo_cos: 0 }
      p[r.group] += r.totals.net
      map.set(r.periodId, p)
    }
    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start)).slice(-12)
  }, [runs])

  const deadlines = useMemo(
    () =>
      deriveRemittances(runs, filings)
        .filter((r) => r.status !== "paid")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [runs, filings]
  )

  const pending = useMemo(() => (user ? pendingForRole(runs, user.role) : []), [runs, user])
  const currentRuns = current?.byGroup.filter((g) => g.run) ?? []
  const projectedAny = current?.byGroup.some((g) => g.projected)
  const hint = current?.byGroup.map((g) => `${GROUP_LABELS[g.group]} ${g.projected ? "projected" : "actual"}`).join(", ")

  return (
    <PageContainer>
      <PageHeader
        eyebrow={HOSPITAL.name}
        title={`Good day, ${user?.name.replace(/^Dr\. /, "").split(" ")[0] ?? ""}`}
        description={`${user ? ROLE_LABELS[user.role] : ""}. Payroll overview as of ${formatDate(DEMO_TODAY)}.`}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Gross pay, current period" icon={BanknoteIcon} value={formatCurrency(current?.gross ?? 0)} hint={period ? `${formatPeriod(period.start, period.end)}. ${hint}` : undefined} />
        <StatCard label="Net pay, current period" icon={WalletIcon} value={formatCurrency(current?.net ?? 0)} hint={projectedAny ? "Includes a dry-run projection for runs not yet computed" : "All runs computed"} />
        <StatCard label="Total deductions" icon={HandCoinsIcon} value={formatCurrency(current?.deductions ?? 0)} hint="GSIS, PhilHealth, Pag-IBIG, tax, loans" />
        <StatCard label="Headcount" icon={UsersIcon} value={headcount.plantilla + headcount.jo_cos} hint={`${headcount.plantilla} Plantilla, ${headcount.jo_cos} JO/COS`}>
          <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="bg-foreground" style={{ width: `${(headcount.plantilla / Math.max(1, headcount.plantilla + headcount.jo_cos)) * 100}%` }} />
          </div>
        </StatCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current payroll runs</CardTitle>
            <CardDescription>{period ? formatPeriod(period.start, period.end) : ""}, pay date {period ? formatDate(period.payDate) : ""}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {GROUPS.map((group) => {
              const g = current?.byGroup.find((x) => x.group === group)
              const run = g?.run
              return (
                <div key={group} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{GROUP_LABELS[group]}</span>
                    {run ? <RunStatusBadge status={run.status} /> : <Badge variant="outline">Not created</Badge>}
                    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                      Net {formatCurrency(g?.totals.net ?? 0)}
                      {g?.projected && " (projected)"}
                    </span>
                  </div>
                  {run ? (
                    <>
                      <WorkflowStepper run={run} compact />
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" render={<Link href={runHref(run)} />}>
                          Open {run.code}
                          <ArrowRightIcon data-icon="inline-end" aria-hidden />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                      No run has been created for this group yet.
                      {user?.role === "hr" && (
                        <Button size="sm" render={<Link href="/payroll/new" />}>
                          Create run
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {currentRuns.length === 0 && <p className="text-sm text-muted-foreground">No runs yet for the current period.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Waiting on you
              {pending.length > 0 && <Badge className="tabular-nums">{pending.length}</Badge>}
            </CardTitle>
            <CardDescription>Payroll runs where the {user ? ROLE_LABELS[user.role] : ""} acts next</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pending.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleCheckBigIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nothing pending</EmptyTitle>
                  <EmptyDescription>No payroll runs are waiting on your role.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y border-t">
                {pending.map((r) => (
                  <li key={r.id}>
                    <Link href={runHref(r)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none">
                      <InboxIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {r.type === "regular" ? `${formatPeriod(r.periodStart, r.periodEnd)}, ${GROUP_LABELS[r.group]}` : r.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {nextStep(r.status)?.action} · {formatCurrency(r.totals.net)} · pay {formatDate(r.payDate)}
                        </span>
                      </span>
                      <RunStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Net payroll trend</CardTitle>
            <CardDescription>Regular payroll, last 12 months</CardDescription>
            <CardAction>
              <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as "chart" | "table")} variant="outline" size="sm" aria-label="Chart or table view">
                <ToggleGroupItem value="chart" aria-label="Chart view">
                  <ChartColumnIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view">
                  <TableIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </CardAction>
          </CardHeader>
          <CardContent>
            {view === "chart" ? (
              <NetTrendChart data={trend} />
            ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1.5 text-left font-medium">Period</th>
                      <th className="py-1.5 text-right font-medium">Plantilla</th>
                      <th className="py-1.5 text-right font-medium">JO/COS</th>
                      <th className="py-1.5 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...trend].reverse().map((t) => (
                      <tr key={t.start} className="border-b border-dashed last:border-0">
                        <td className="py-1.5">{formatPeriod(t.start, t.end)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(t.plantilla)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(t.jo_cos)}</td>
                        <td className="py-1.5 text-right font-medium">{formatCurrency(t.plantilla + t.jo_cos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming remittance deadlines</CardTitle>
            <CardDescription>Unpaid GSIS, PhilHealth, Pag-IBIG, and BIR remittances</CardDescription>
            <CardAction>
              <Button size="sm" variant="ghost" render={<Link href="/remittances" />}>
                All
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {deadlines.map((r) => {
                const days = differenceInCalendarDays(parseISO(r.dueDate), parseISO(DEMO_TODAY))
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {AGENCY_LABELS[r.agency]}, {formatMonth(r.month)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {days < 0 && <TriangleAlertIcon className="size-3" aria-hidden />}
                        Due {formatDate(r.dueDate)}, {days < 0 ? `overdue by ${-days} days` : days === 0 ? "today" : `in ${days} days`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block tabular-nums">{formatCurrency(r.employeeShare + r.governmentShare)}</span>
                      <RemittanceStatusBadge status={r.status} />
                    </span>
                  </li>
                )
              })}
              {deadlines.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">All remittances are paid.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest actions across payroll, employees, and settings</CardDescription>
          <CardAction>
            <Button size="sm" variant="ghost" render={<Link href="/audit-log" />}>
              Audit log
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y border-t">
            {audit.slice(0, 8).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                <span className="font-medium">{a.userName}</span>
                <span className="text-muted-foreground">{a.action.charAt(0).toLowerCase() + a.action.slice(1)}</span>
                <span className="min-w-0 flex-1 truncate">{a.entityLabel}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
