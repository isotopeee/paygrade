"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRightIcon, LandmarkIcon } from "lucide-react"

import type { Employee } from "@/types"
import { LOAN_TYPE_LABELS } from "@/lib/constants"
import { formatMonth, formatPercent } from "@/lib/format"
import { yearsBetween } from "@/lib/payroll/calendar"
import {
  computeGsis,
  computeJoCosWithholding,
  computeLongevityPay,
  computePagibig,
  computePhilhealth,
  computeWithholdingTax,
} from "@/lib/payroll/compute"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { Money } from "@/components/money"
import { LoanStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { useEmployeeRates } from "./use-employee-rates"

interface ContributionRow {
  label: string
  basis: string
  employee: number
  government: number
}

export function DeductionsTab({ employee }: { employee: Employee }) {
  const allLoans = useDataStore((s) => s.loans)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const { rates, monthlyRate, plantilla } = useEmployeeRates(employee)
  const group = plantilla ? "plantilla" : "jo_cos"

  const loans = useMemo(
    () =>
      allLoans
        .filter((l) => l.employeeId === employee.id)
        .sort((a, b) => a.status.localeCompare(b.status) || b.startPeriod.localeCompare(a.startPeriod)),
    [allLoans, employee.id]
  )

  const contributions = useMemo<ContributionRow[]>(() => {
    const gsis = computeGsis(monthlyRate, group, rates)
    const philhealth = computePhilhealth(monthlyRate, group, rates)
    const pagibig = computePagibig(monthlyRate, group, rates)

    let tax: number
    let taxBasis: string
    if (plantilla) {
      const taxableAllowances = employee.allowances.reduce((sum, a) => {
        const type = allowanceTypes.find((t) => t.id === a.allowanceTypeId)
        return type?.active && type.taxable ? sum + (a.amount || type.defaultMonthly) : sum
      }, 0)
      const longevity = employee.isHealthWorker
        ? computeLongevityPay(monthlyRate, yearsBetween(employee.dateHired, DEMO_TODAY), rates)
        : 0
      const taxable = Math.max(
        0,
        monthlyRate + taxableAllowances + longevity - gsis.personal - philhealth.employee - pagibig.employee
      )
      tax = computeWithholdingTax(taxable, rates.withholding.monthly)
      taxBasis = "Monthly withholding table (TRAIN) on taxable compensation"
    } else {
      tax = computeJoCosWithholding(monthlyRate, employee.swornDeclaration ?? false, rates)
      taxBasis = employee.swornDeclaration
        ? "Sworn declaration on file, no tax withheld"
        : `${formatPercent(rates.joCos.withholdingRate)} flat rate on gross`
    }

    return [
      {
        label: "GSIS life and retirement",
        basis: plantilla
          ? `${formatPercent(rates.gsis.personalRate)} personal, ${formatPercent(rates.gsis.governmentRate)} government`
          : "Not a GSIS member",
        employee: gsis.personal,
        government: gsis.government,
      },
      ...(plantilla
        ? [{ label: "GSIS ECC", basis: "Employees' Compensation, government share only", employee: 0, government: rates.gsis.eccMonthly }]
        : []),
      {
        label: "PhilHealth",
        basis: `${formatPercent(rates.philhealth.premiumRate)} premium${plantilla ? ", shared equally" : ", employee pays own share"}`,
        employee: philhealth.employee,
        government: philhealth.government,
      },
      {
        label: "Pag-IBIG",
        basis: plantilla ? "Employee and employer shares on the fund salary" : "Employee share only",
        employee: pagibig.employee,
        government: pagibig.government,
      },
      { label: "Withholding tax", basis: taxBasis, employee: tax, government: 0 },
    ]
  }, [monthlyRate, group, plantilla, rates, employee, allowanceTypes])

  const totalEmployee = contributions.reduce((s, r) => s + r.employee, 0)
  const totalGovernment = contributions.reduce((s, r) => s + r.government, 0)

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Mandatory deductions</CardTitle>
          <CardDescription>
            Monthly estimate on a {plantilla ? "basic salary" : "monthly equivalent"} of{" "}
            <Money value={monthlyRate} />, assuming full attendance. Actual amounts are computed in each monthly payroll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Deduction</TableHead>
                <TableHead className="hidden md:table-cell">Basis</TableHead>
                <TableHead className="text-right">Employee share</TableHead>
                <TableHead className="text-right">Government share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">
                    {r.label}
                    <div className="text-xs font-normal text-muted-foreground md:hidden">{r.basis}</div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{r.basis}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.employee} muteZero />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.government} muteZero />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right font-semibold">
                  <Money value={totalEmployee} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={totalGovernment} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loans and authorized deductions</CardTitle>
          <CardDescription>Monthly amortization is deducted in full from each monthly payroll.</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" render={<Link href="/loans" />}>
              All loans
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <Empty className="border py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LandmarkIcon />
                </EmptyMedia>
                <EmptyTitle>No loans on file</EmptyTitle>
                <EmptyDescription>
                  GSIS, Pag-IBIG, cooperative, and Landbank loans deducted through payroll will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="min-w-32">Paid</TableHead>
                  <TableHead className="hidden lg:table-cell">Term</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => {
                  const balance = Math.max(0, loan.totalPayable - loan.paidToDate)
                  const pct = loan.totalPayable > 0 ? Math.min(100, (loan.paidToDate / loan.totalPayable) * 100) : 0
                  return (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="font-medium">{LOAN_TYPE_LABELS[loan.type]}</div>
                        <div className="font-mono text-xs text-muted-foreground">{loan.referenceNo}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={loan.monthlyAmortization} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={balance} muteZero />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={pct}
                            aria-label={`${Math.round(pct)}% paid`}
                            className="flex-1"
                          />
                          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {formatMonth(loan.startPeriod)} to {formatMonth(loan.endPeriod)}
                      </TableCell>
                      <TableCell>
                        <LoanStatusBadge status={loan.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
