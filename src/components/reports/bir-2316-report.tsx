"use client"

import { useMemo, useState } from "react"

import type { Centavos } from "@/types"
import { groupOf, HOSPITAL } from "@/lib/constants"
import { formatAmount, formatDate, formatMonthLong, registerName } from "@/lib/format"
import { buildForm2316, type MonthlyCompensationRow, type ReportMeta } from "@/lib/reports"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { amountColumn, FooterLabel } from "./columns"
import { NoRunsState } from "./no-data"
import { FilterSelect, ReportLayout, ReportNote } from "./report-layout"
import { SignatureBlock } from "./signature-block"

const YEAR = DEMO_TODAY.slice(0, 4)
const AS_OF = `${DEMO_TODAY.slice(0, 7)}-30`

const col = createColumns<MonthlyCompensationRow>()
const monthlyColumns = col.columns([
  col.accessor("month", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Month" />,
    cell: ({ getValue }) => formatMonthLong(`${getValue()}-01`),
    footer: () => <FooterLabel>Year to date</FooterLabel>,
    meta: { label: "Month" },
  }),
  amountColumn(col, "gross", "Gross compensation"),
  amountColumn(col, "nonTaxable", "Non-taxable"),
  amountColumn(col, "taxable", "Taxable"),
  amountColumn(col, "taxWithheld", "Tax withheld", { emphasize: true }),
])

function Row({
  label,
  value,
  strong,
  indent,
}: {
  label: string
  value: Centavos | string
  strong?: boolean
  indent?: boolean
}) {
  return (
    <div className={cn("flex items-baseline gap-3 border-b py-1.5 last:border-b-0", strong && "font-semibold")}>
      <span className={cn("flex-1", indent && "pl-3 text-muted-foreground")}>{label}</span>
      <span className="font-mono tabular-nums">{typeof value === "number" ? formatAmount(value) : value}</span>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="text-[0.6875rem] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("truncate border-b pb-1", mono && "font-mono text-xs")}>{value}</div>
    </div>
  )
}

export function Bir2316Report({ meta }: { meta: ReportMeta }) {
  const employees = useDataStore((s) => s.employees)
  const runs = useDataStore((s) => s.runs)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const signatories = useDataStore((s) => s.signatories)

  const plantilla = useMemo(
    () =>
      employees
        .filter((e) => groupOf(e.employmentType) === "plantilla")
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [employees]
  )
  const [employeeId, setEmployeeId] = useState(() => plantilla[0]?.id ?? "")
  const [year, setYear] = useState(YEAR)
  const employee = plantilla.find((e) => e.id === employeeId) ?? plantilla[0]
  const form = useMemo(
    () => (employee ? buildForm2316({ employee, runs, allowanceTypes, ratesVersions, year, asOf: AS_OF }) : null),
    [employee, runs, allowanceTypes, ratesVersions, year]
  )
  const authorized = signatories.find((s) => s.role === "certified_by")

  return (
    <ReportLayout
      meta={meta}
      fileStem={`bir-2316-${employee?.employeeNo ?? "none"}-${year}`}
      exportDisabled={!employee}
      filters={
        <>
          <FilterSelect
            id="bir-employee"
            label="Employee (plantilla)"
            value={employee?.id ?? ""}
            onChange={setEmployeeId}
            options={plantilla.map((e) => ({ value: e.id, label: `${registerName(e)} (${e.employeeNo})` }))}
            className="w-80 max-w-full"
          />
          <FilterSelect id="bir-year" label="Year" value={year} onChange={setYear} options={[{ value: YEAR, label: YEAR }]} className="w-28" />
        </>
      }
    >
      {!employee || !form ? (
        <NoRunsState title="No plantilla employees" description="Add plantilla employees to generate BIR Form 2316." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Year to date as of Sep 2026 (projected annualization)</Badge>
            <span className="text-xs text-muted-foreground">
              {form.monthsPaid} regular monthly payrolls paid from Jan 1 to {formatDate(AS_OF)}. Not a final certificate; issue after year-end annualization.
            </span>
          </div>

          <Card>
            <CardHeader className="border-b text-center">
              <div className="text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
                Republic of the Philippines, Department of Finance, Bureau of Internal Revenue
              </div>
              <CardTitle className="text-base">Certificate of Compensation Payment / Tax Withheld</CardTitle>
              <CardDescription>BIR Form No. 2316. For compensation payment with or without tax withheld.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="part1" className="space-y-3">
                <h3 id="part1" className="text-xs font-semibold tracking-wide uppercase">
                  Part I. Employee information
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="For the year" value={year} mono />
                  <Field label="For the period" value={`Jan 1 to ${formatDate(AS_OF)}`} />
                  <Field label="Taxpayer Identification Number" value={employee.tin} mono />
                  <Field label="Employee No." value={employee.employeeNo} mono />
                  <div className="sm:col-span-2">
                    <Field label="Employee name (last, first, middle)" value={`${employee.lastName.toUpperCase()}, ${employee.firstName} ${employee.middleName}`} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Registered address" value={employee.address} />
                  </div>
                  <Field label="Date of birth" value={formatDate(employee.birthDate)} />
                  <Field label="Position" value={employee.positionTitle} />
                </div>
              </section>
              <section aria-labelledby="part2" className="space-y-3">
                <h3 id="part2" className="text-xs font-semibold tracking-wide uppercase">
                  Part II. Employer information (present)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Taxpayer Identification Number" value={HOSPITAL.tin} mono />
                  <Field label="Type of employer" value="Main employer" />
                  <div className="sm:col-span-2">
                    <Field label="Employer name" value={HOSPITAL.name} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Registered address" value={HOSPITAL.address} />
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Part IV-B. Details of compensation income</CardTitle>
                <CardDescription>Amounts in pesos, year to date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="mb-1 text-xs font-semibold tracking-wide uppercase">A. Non-taxable or exempt compensation</div>
                  <Row label="Basic salary of minimum wage earners" value={0} />
                  <Row label="13th month pay and other benefits (up to ceiling)" value={form.tax.exemptBonuses} />
                  <Row label="De minimis benefits (subsistence, laundry, uniform)" value={form.breakdown.deMinimis} />
                  <Row label="GSIS, PhilHealth, and Pag-IBIG contributions (employee share)" value={form.breakdown.contributions} />
                  <Row label="PERA and other non-taxable allowances (RATA)" value={form.breakdown.pera + form.breakdown.nonTaxableAllowances} />
                  <Row label="Total non-taxable or exempt compensation" value={form.tax.nonTaxable} strong />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold tracking-wide uppercase">B. Taxable compensation income, regular</div>
                  <Row label="Basic salary (net of mandatory contributions)" value={form.breakdown.basic - form.breakdown.contributions} />
                  <Row label="Taxable allowances (longevity pay, hazard pay)" value={form.breakdown.taxableAllowances} />
                  <Row label="Overtime, night differential, and other earnings" value={form.breakdown.otherTaxable} />
                  <div className="mt-2 mb-1 text-xs font-semibold tracking-wide uppercase">Supplementary</div>
                  <Row
                    label={`13th month pay and other benefits in excess of ${formatAmount(form.exemptionCeiling)}`}
                    value={form.tax.taxableBonuses}
                  />
                  <Row label="Total taxable compensation income" value={form.tax.taxable} strong />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Part IV-A. Summary</CardTitle>
                <CardDescription>Projected annualization using the annual BIR withholding table in force.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <Row label="Gross compensation income, year to date" value={form.breakdown.gross} />
                  <Row label="Less: total non-taxable or exempt compensation" value={form.tax.nonTaxable} />
                  <Row label="Taxable compensation income, year to date" value={form.tax.taxable} strong />
                  <Row label="Projected annual taxable compensation" value={form.projectedAnnualTaxable} indent />
                  <Row label="Tax due for the year (projected)" value={form.annualTaxDue} strong />
                  <Row label="Tax due to date (pro rata by months paid)" value={form.taxDueToDate} indent />
                  <Row label="Tax withheld to date" value={form.taxWithheld} strong />
                  <Row
                    label={form.difference >= 0 ? "Over-withheld to date" : "Under-withheld to date"}
                    value={Math.abs(form.difference)}
                    strong
                  />
                  <Row label="Remaining tax to withhold for the year" value={form.remainingForYear} indent />
                </div>
                <ReportNote>
                  Taxable pay from regular payroll is extrapolated to 12 months; taxable special payroll benefits are added as paid.
                  The final tax due is determined at year-end annualization in December.
                </ReportNote>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Present employer or authorized agent</div>
                    <SignatureBlock name={authorized?.name ?? ""} position={authorized?.position ?? ""} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Conforme: employee</div>
                    <SignatureBlock name={`${employee.firstName} ${employee.middleName.charAt(0)}. ${employee.lastName}`} position="Employee" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Monthly breakdown</h2>
            <DataTable
              columns={monthlyColumns}
              data={form.monthly}
              getRowId={(r) => r.month}
              dense
              showFooter
              hidePagination
              emptyState={{ title: "No compensation paid", description: `No computed payroll lines for this employee in ${year}.` }}
            />
          </div>
        </>
      )}
    </ReportLayout>
  )
}
