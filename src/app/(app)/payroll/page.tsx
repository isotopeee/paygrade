"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRightIcon, CalendarClockIcon, PlusIcon } from "lucide-react"

import { GROUP_LABELS, ROLE_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format"
import { sumBy } from "@/lib/payroll/money"
import { can } from "@/lib/permissions"
import { pendingForRole } from "@/lib/selectors"
import { nextStep } from "@/lib/workflow"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { CURRENT_PERIOD_ID } from "@/data/seed"
import { PageContainer, PageHeader } from "@/components/page-header"
import { RunsTable } from "@/components/payroll/runs-table"
import { StatCard } from "@/components/stat-card"
import { RunStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PayrollRunsPage() {
  const role = useRole()
  const runs = useDataStore((s) => s.runs)
  const periods = useDataStore((s) => s.periods)

  const current = periods.find((p) => p.id === CURRENT_PERIOD_ID)
  const currentRuns = runs.filter((r) => r.periodId === CURRENT_PERIOD_ID)
  const pending = useMemo(() => (role ? pendingForRole(runs, role) : []), [runs, role])
  const released2026 = runs.filter((r) => r.status === "released" && r.payDate.startsWith("2026"))
  const lastReleased = [...runs]
    .filter((r) => r.status === "released" && r.type === "regular")
    .sort((a, b) => b.payDate.localeCompare(a.payDate))

  return (
    <PageContainer>
      <PageHeader
        title="Payroll Runs"
        description="Monthly regular payroll for Plantilla and JO/COS. Each run moves from Draft to Released through HR, Accounting, the Chief of Hospital, and the Cashier."
        actions={
          can(role, "payroll.create") && (
            <Button render={<Link href="/payroll/new" />}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              Create payroll run
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Current period"
          value={current ? formatPeriod(current.start, current.end) : "None"}
          icon={CalendarClockIcon}
          hint={
            currentRuns.length
              ? currentRuns.map((r) => `${GROUP_LABELS[r.group]}: ${r.status}`).join(", ")
              : "No run created yet"
          }
        />
        <StatCard
          label="Awaiting your action"
          value={pending.length}
          hint={role ? ROLE_LABELS[role] : undefined}
        />
        <StatCard
          label="Last released net pay"
          value={formatCurrency(sumBy(lastReleased.filter((r) => r.payDate === lastReleased[0]?.payDate), (r) => r.totals.net))}
          hint={lastReleased[0] ? `Paid ${formatDate(lastReleased[0].payDate)}` : undefined}
        />
        <StatCard
          label="Net payroll released, 2026"
          value={formatCurrency(sumBy(released2026, (r) => r.totals.net))}
          hint={`${released2026.length} runs, including special payroll`}
        />
      </div>

      {pending.length > 0 && role && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Waiting on you</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {pending.map((r) => {
              const step = nextStep(r.status)
              return (
                <Link
                  key={r.id}
                  href={r.type === "special" ? `/special-payroll/${r.id}` : `/payroll/${r.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                  <span className="font-medium">
                    {r.type === "regular" ? `${formatPeriod(r.periodStart, r.periodEnd)}, ${GROUP_LABELS[r.group]}` : r.title}
                  </span>
                  <RunStatusBadge status={r.status} />
                  <span className="ml-auto flex items-center gap-1 text-xs">
                    {step?.action}
                    <ArrowRightIcon className="size-3.5" aria-hidden />
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      <RunsTable runs={runs} />
    </PageContainer>
  )
}
