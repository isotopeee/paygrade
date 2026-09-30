"use client"

import { useMemo } from "react"
import { HandCoinsIcon } from "lucide-react"

import type { Employee } from "@/types"
import { formatCurrency, formatPercent } from "@/lib/format"
import { yearsBetween } from "@/lib/payroll/calendar"
import { computeLongevityPay, hazardRateFor } from "@/lib/payroll/compute"
import { applyRate } from "@/lib/payroll/money"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { Money } from "@/components/money"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { useEmployeeRates } from "./use-employee-rates"

/** Allowances computed from rates below, never taken from the employee's assigned list. */
const COMPUTED_ALLOWANCE_IDS = new Set(["alw-longevity", "alw-hazard", "alw-subsistence", "alw-laundry", "alw-uniform"])

interface CompLine {
  label: string
  basis: string
  amount: number
}

function CompTable({ lines, totalLabel }: { lines: CompLine[]; totalLabel: string }) {
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Item</TableHead>
          <TableHead className="hidden sm:table-cell">Basis</TableHead>
          <TableHead className="text-right">Monthly</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.label}>
            <TableCell className="font-medium">
              {l.label}
              <div className="text-xs font-normal text-muted-foreground sm:hidden">{l.basis}</div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">{l.basis}</TableCell>
            <TableCell className="text-right">
              <Money value={l.amount} muteZero />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-transparent">
          <TableCell className="font-medium">{totalLabel}</TableCell>
          <TableCell className="hidden sm:table-cell" />
          <TableCell className="text-right font-semibold">
            <Money value={total} />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

export function CompensationTab({ employee }: { employee: Employee }) {
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const { rates, monthlyRate, plantilla } = useEmployeeRates(employee)

  const { regular, magnaCarta } = useMemo(() => {
    const regular: CompLine[] = [
      { label: "Basic salary", basis: `SG ${employee.salaryGrade ?? 1}, Step ${employee.step ?? 1}`, amount: monthlyRate },
      { label: "PERA", basis: "Personnel Economic Relief Allowance", amount: rates.peraMonthly },
    ]
    for (const assigned of employee.allowances) {
      const type = allowanceTypes.find((t) => t.id === assigned.allowanceTypeId)
      if (!type || COMPUTED_ALLOWANCE_IDS.has(type.id)) continue
      regular.push({
        label: type.name,
        basis: `${type.legalBasis}${type.active ? "" : " (inactive)"}`,
        amount: type.active ? assigned.amount || type.defaultMonthly : 0,
      })
    }
    const years = yearsBetween(employee.dateHired, DEMO_TODAY)
    const blocks = Math.floor(years / rates.magnaCarta.longevityYearsPerBlock)
    if (employee.isHealthWorker) {
      regular.push({
        label: "Longevity pay",
        basis:
          blocks > 0
            ? `${formatPercent(rates.magnaCarta.longevityRate * blocks)} of basic for ${years} years of service`
            : `Starts after ${rates.magnaCarta.longevityYearsPerBlock} years of service`,
        amount: computeLongevityPay(monthlyRate, years, rates),
      })
    }

    const magnaCarta: CompLine[] = []
    if (employee.isHealthWorker) {
      const days = Math.min(22, rates.magnaCarta.subsistenceMaxDays)
      const hazardRate = hazardRateFor(employee.salaryGrade ?? 1, rates)
      magnaCarta.push(
        {
          label: "Subsistence allowance (est.)",
          basis: `${days} working days at ${formatCurrency(rates.magnaCarta.subsistencePerDay)} per day`,
          amount: rates.magnaCarta.subsistencePerDay * days,
        },
        { label: "Laundry allowance", basis: "RA 7305, Sec. 22", amount: rates.magnaCarta.laundryMonthly },
        {
          label: "Hazard pay",
          basis: `${formatPercent(hazardRate)} of basic for SG ${employee.salaryGrade ?? 1}`,
          amount: applyRate(monthlyRate, hazardRate),
        }
      )
    }
    return { regular, magnaCarta }
  }, [employee, allowanceTypes, rates, monthlyRate])

  if (!plantilla) {
    return (
      <Card>
        <CardContent>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HandCoinsIcon />
              </EmptyMedia>
              <EmptyTitle>No allowances for JO and COS workers</EmptyTitle>
              <EmptyDescription>
                Job Order and Contract of Service workers receive only their contract rate. They are not entitled to
                PERA, RATA, or Magna Carta benefits (subsistence, laundry, hazard, and longevity pay) in this prototype.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  const regularTotal = regular.reduce((s, l) => s + l.amount, 0)
  const magnaTotal = magnaCarta.reduce((s, l) => s + l.amount, 0)

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Regular payroll</CardTitle>
          <CardDescription>Paid in full with the monthly payroll.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompTable lines={regular} totalLabel="Monthly regular pay" />
        </CardContent>
      </Card>

      {magnaCarta.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Magna Carta benefits</CardTitle>
            <CardDescription>
              RA 7305 benefits for public health workers, paid through special payroll. Amounts are monthly estimates
              assuming full attendance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompTable lines={magnaCarta} totalLabel="Monthly Magna Carta benefits" />
          </CardContent>
        </Card>
      )}

      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Estimated monthly compensation</div>
            <div className="text-xs text-muted-foreground">Regular pay plus Magna Carta benefits, before deductions.</div>
          </div>
          <Money value={regularTotal + magnaTotal} className="text-xl font-semibold" />
        </CardContent>
      </Card>
    </div>
  )
}
