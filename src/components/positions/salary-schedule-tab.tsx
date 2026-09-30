"use client"

import { useMemo, useState } from "react"
import { CalendarClockIcon, CircleCheckBigIcon, InfoIcon, LockIcon, PencilLineIcon } from "lucide-react"

import { formatDate, formatDateTime } from "@/lib/format"
import { scheduleForDate } from "@/lib/payroll/engine"
import { can } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { DEMO_TODAY } from "@/data/seed"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"

import { SalaryMatrix } from "./salary-matrix"
import { SalaryScheduleEditor } from "./salary-schedule-editor"

export function SalaryScheduleTab() {
  const role = useRole()
  const schedules = useDataStore((s) => s.salarySchedules)
  const canManage = can(role, "salary_schedule.manage")

  const sorted = useMemo(
    () => [...schedules].sort((a, b) => b.effectivityDate.localeCompare(a.effectivityDate)),
    [schedules]
  )
  const inForce = useMemo(() => scheduleForDate(schedules, DEMO_TODAY), [schedules])
  const latest = sorted[0] ?? inForce

  const [selectedId, setSelectedId] = useState<string>(inForce.id)
  const [editing, setEditing] = useState(false)

  const selected = sorted.find((s) => s.id === selectedId) ?? inForce
  const selectedIndex = sorted.findIndex((s) => s.id === selected.id)
  const previous = selectedIndex >= 0 ? sorted[selectedIndex + 1] : undefined

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Salary schedule version" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((s) => {
          const active = s.id === selected.id && !editing
          const isInForce = s.id === inForce.id
          const upcoming = s.effectivityDate > DEMO_TODAY
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              disabled={editing}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                active && "border-foreground bg-muted/60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{s.name}</span>
                {isInForce && <StatusBadge label="In force" icon={CircleCheckBigIcon} tone="solid" />}
                {upcoming && <StatusBadge label="Upcoming" icon={CalendarClockIcon} tone="outline" />}
              </div>
              <span className="text-xs text-muted-foreground">Effective {formatDate(s.effectivityDate)}</span>
              <span className="truncate text-xs text-muted-foreground" title={s.legalBasis}>
                {s.legalBasis}
              </span>
            </button>
          )
        })}
      </div>

      {editing ? (
        <SalaryScheduleEditor
          base={latest}
          latestDate={latest.effectivityDate}
          onCancel={() => setEditing(false)}
          onSaved={(id) => {
            setSelectedId(id)
            setEditing(false)
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold">{selected.name}</h2>
              <p className="text-xs text-muted-foreground">
                Monthly basic salary in pesos. Effective {formatDate(selected.effectivityDate)}. {selected.legalBasis}.
                Published by {selected.createdBy} on {formatDateTime(selected.createdAt)}.
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setEditing(true)}>
                <PencilLineIcon data-icon="inline-start" />
                Edit as new version
              </Button>
            )}
          </div>

          {!canManage && (
            <Alert>
              <LockIcon />
              <AlertTitle>Read only</AlertTitle>
              <AlertDescription>
                Only the System Admin can publish a new salary schedule tranche. Contact the administrator when a new DBM
                National Budget Circular is issued.
              </AlertDescription>
            </Alert>
          )}

          <SalaryMatrix
            matrix={selected.matrix}
            previous={previous?.matrix}
            previousName={previous?.name}
            caption={`${selected.name} salary schedule, salary grade 1 to 33 by step 1 to 8`}
          />
          {previous && (
            <p className="text-xs text-muted-foreground">
              Step 1 change compares each grade with {previous.name} (effective {formatDate(previous.effectivityDate)}).
            </p>
          )}
        </>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Values are seed data for this prototype. Verify every cell against the DBM National Budget Circular that implements
        the tranche before using it for payroll.
      </p>
    </div>
  )
}
