"use client"

import Link from "next/link"
import {
  BanIcon,
  ClockAlertIcon,
  PlaneIcon,
  UserMinusIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"

import type { Department, Employee } from "@/types"
import { formatDate, fullName } from "@/lib/format"
import type { RunExceptions } from "@/lib/payroll/engine"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Category {
  key: keyof RunExceptions
  title: string
  icon: LucideIcon
  treatment: string
  detail: (e: Employee) => string
}

const CATEGORIES: Category[] = [
  {
    key: "missingDtr",
    title: "Missing DTR",
    icon: ClockAlertIcon,
    treatment: "Computed as full attendance unless excluded. Import logs from Time and Attendance to correct.",
    detail: () => "No biometric or manual DTR for the period",
  },
  {
    key: "newHires",
    title: "New hires",
    icon: UserPlusIcon,
    treatment: "Basic pay, PERA, and allowances are prorated from the hire date.",
    detail: (e) => `Hired ${formatDate(e.dateHired)}`,
  },
  {
    key: "separations",
    title: "Separations",
    icon: UserMinusIcon,
    treatment: "Pay is prorated up to the separation date. Final pay and clearance are processed separately.",
    detail: (e) => `Separated ${e.separationDate ? formatDate(e.separationDate) : ""}`,
  },
  {
    key: "onLeave",
    title: "On leave",
    icon: PlaneIcon,
    treatment: "Leave with pay is paid in full. Confirm the leave application is approved.",
    detail: () => "Approved leave with pay",
  },
  {
    key: "suspended",
    title: "Suspended",
    icon: BanIcon,
    treatment: "Excluded from this run.",
    detail: () => "Under preventive suspension",
  },
]

export function RunExceptionsPanel({
  exceptions,
  departments,
  excluded,
  onToggleExclude,
  className,
}: {
  exceptions: RunExceptions
  departments: Department[]
  /** Employee ids excluded from the run (only missing DTR can be excluded from here). */
  excluded?: Set<string>
  onToggleExclude?: (employeeId: string) => void
  className?: string
}) {
  const total = CATEGORIES.reduce((n, c) => n + exceptions[c.key].length, 0)
  return (
    <div className={cn("space-y-3", className)}>
      {total === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No exceptions found for this period and group.
        </p>
      )}
      {CATEGORIES.filter((c) => exceptions[c.key].length > 0).map((c) => (
        <section key={c.key} className="rounded-lg border">
          <header className="flex flex-wrap items-start gap-3 border-b p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <c.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                {c.title}
                <Badge variant="secondary" className="tabular-nums">
                  {exceptions[c.key].length}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">{c.treatment}</p>
            </div>
          </header>
          <ul className="divide-y">
            {exceptions[c.key].map((e) => {
              const isExcluded = excluded?.has(e.id)
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <Link href={`/employees/${e.id}`} className={cn("font-medium hover:underline", isExcluded && "line-through opacity-60")}>
                    {fullName(e)}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">{e.employeeNo}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.positionTitle}, {departments.find((d) => d.id === e.departmentId)?.name}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.detail(e)}</span>
                  {c.key === "missingDtr" && onToggleExclude && (
                    <button
                      type="button"
                      onClick={() => onToggleExclude(e.id)}
                      className="rounded-md border px-2 py-0.5 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-pressed={isExcluded}
                    >
                      {isExcluded ? "Include" : "Exclude from run"}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
