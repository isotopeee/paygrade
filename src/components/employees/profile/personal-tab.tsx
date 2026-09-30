"use client"

import type { Employee } from "@/types"
import { groupOf } from "@/lib/constants"
import { ageOn, maskAccount } from "@/lib/employees"
import { formatDate } from "@/lib/format"
import { DEMO_TODAY } from "@/data/seed"
import { InfoGrid } from "@/components/info-grid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const CIVIL: Record<Employee["civilStatus"], string> = {
  single: "Single",
  married: "Married",
  widowed: "Widowed",
  separated: "Separated",
}

export function PersonalTab({ employee }: { employee: Employee }) {
  const plantilla = groupOf(employee.employmentType) === "plantilla"
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>From the Personal Data Sheet (CS Form 212).</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid
            columns={4}
            items={[
              { label: "First name", value: employee.firstName },
              { label: "Middle name", value: employee.middleName || undefined },
              { label: "Last name", value: employee.lastName },
              { label: "Suffix", value: employee.suffix ?? <span className="text-muted-foreground">None</span> },
              { label: "Sex", value: employee.sex === "male" ? "Male" : "Female" },
              { label: "Civil status", value: CIVIL[employee.civilStatus] },
              {
                label: "Birth date",
                value: `${formatDate(employee.birthDate)} (age ${ageOn(employee.birthDate, DEMO_TODAY)})`,
                span: 2,
              },
              { label: "Address", value: employee.address, span: 2 },
              { label: "Mobile", value: <span className="tabular-nums">{employee.mobile}</span> },
              { label: "Email", value: employee.email },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Government IDs</CardTitle>
          <CardDescription>Used for BIR, GSIS, PhilHealth, and Pag-IBIG remittance schedules.</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid
            columns={3}
            items={[
              { label: "TIN", value: employee.tin, mono: true },
              {
                label: "GSIS BP No.",
                value: plantilla ? employee.gsisBpNo : <span className="text-muted-foreground">Not a GSIS member</span>,
                mono: plantilla,
              },
              { label: "PhilHealth No.", value: employee.philhealthNo, mono: true },
              { label: "Pag-IBIG MID", value: employee.pagibigMid, mono: true },
              {
                label: "Landbank account",
                value: <span aria-label={`Account ending in ${employee.bankAccountNo.slice(-4)}`}>{maskAccount(employee.bankAccountNo)}</span>,
                mono: true,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
