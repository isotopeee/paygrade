"use client"

import { CalendarOffIcon } from "lucide-react"

import type { Employee } from "@/types"
import { groupOf } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

function days(n: number): string {
  const text = Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "")
  return text
}

function LeaveEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarOffIcon />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  )
}

export function LeaveTab({ employee }: { employee: Employee }) {
  const credit = useDataStore((s) => s.leaveCredits.find((c) => c.employeeId === employee.id))

  if (groupOf(employee.employmentType) !== "plantilla") {
    return (
      <LeaveEmpty
        title="No leave credits"
        description="Job Order and Contract of Service workers do not earn leave credits."
      />
    )
  }
  if (!credit) {
    return (
      <LeaveEmpty
        title="No leave card on file"
        description="Leave credits appear here once the leave card is posted by HR."
      />
    )
  }

  const asOf = `As of ${formatDate(credit.asOf)}`
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Vacation leave" value={days(credit.vacationLeave)} hint={`Days. ${asOf}`} />
        <StatCard label="Sick leave" value={days(credit.sickLeave)} hint={`Days. ${asOf}`} />
        <StatCard label="Special privilege leave" value={days(credit.specialPrivilegeLeave)} hint="Days left this year, non-cumulative" />
        <StatCard label="Forced leave" value={days(credit.forcedLeave)} hint="Mandatory 5 days per year, deducted from VL" />
      </div>
      <p className="text-xs text-muted-foreground">
        Vacation and sick leave accrue at 1.25 days each per month of service under CSC rules. Leave without pay is
        deducted in payroll as absences.
      </p>
    </div>
  )
}
