"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { GROUP_LABELS } from "@/lib/constants"
import { formatCurrency, formatCurrencyCompact, formatMonthLong, formatNumber } from "@/lib/format"
import { pesos, toPesos } from "@/lib/payroll/money"
import {
  buildDepartmentSummary,
  runMonths,
  type DepartmentSummaryRow,
  type GroupFilter,
  type ReportMeta,
} from "@/lib/reports"
import { useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

import { amountColumn, FooterLabel } from "./columns"
import { NoRunsState } from "./no-data"
import { FilterSelect, ReportLayout, ReportNote } from "./report-layout"

const col = createColumns<DepartmentSummaryRow>()

const columns = col.columns([
  col.accessor("code", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
    footer: () => <FooterLabel>Totals</FooterLabel>,
    meta: { label: "Code" },
  }),
  col.accessor("name", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.costCenter}</div>
      </div>
    ),
    footer: ({ table }) => <FooterLabel>{table.getFilteredRowModel().rows.length} departments</FooterLabel>,
    meta: { label: "Department" },
  }),
  col.accessor("headcount", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Headcount" />,
    cell: ({ getValue }) => formatNumber(getValue()),
    footer: ({ table }) => {
      let total = 0
      for (const r of table.getFilteredRowModel().rows) total += r.original.headcount
      return formatNumber(total)
    },
    meta: { numeric: true, label: "Headcount" },
  }),
  amountColumn(col, "gross", "Gross"),
  amountColumn(col, "totalDeductions", "Total deductions"),
  amountColumn(col, "net", "Net", { emphasize: true }),
  amountColumn(col, "employerShares", "Employer shares"),
  amountColumn(col, "psCost", "Total PS cost", { emphasize: true }),
])

const chartConfig = {
  net: { label: "Net pay", color: "var(--chart-1)" },
} satisfies ChartConfig

const GROUP_OPTIONS: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "All groups" },
  { value: "plantilla", label: GROUP_LABELS.plantilla },
  { value: "jo_cos", label: GROUP_LABELS.jo_cos },
]

export function DepartmentSummaryReport({ meta }: { meta: ReportMeta }) {
  const runs = useDataStore((s) => s.runs)
  const departments = useDataStore((s) => s.departments)
  const months = useMemo(() => runMonths(runs), [runs])
  const [monthValue, setMonth] = useState(() => months[0] ?? "")
  const [group, setGroup] = useState<GroupFilter>("all")
  const month = months.includes(monthValue) ? monthValue : (months[0] ?? "")
  const rows = useMemo(
    () => (month ? buildDepartmentSummary(runs, departments, month, group) : []),
    [runs, departments, month, group]
  )
  const chartData = useMemo(() => rows.map((r) => ({ name: r.name, net: toPesos(r.net) })), [rows])

  return (
    <ReportLayout
      meta={meta}
      fileStem={`summary-by-department-${month || "none"}-${group === "jo_cos" ? "jo-cos" : group}`}
      rows={rows.length}
      exportDisabled={!month}
      filters={
        <>
          <FilterSelect
            id="ds-month"
            label="Month"
            value={month}
            onChange={setMonth}
            options={months.map((m) => ({ value: m, label: formatMonthLong(`${m}-01`) }))}
            className="w-48"
          />
          <FilterSelect
            id="ds-group"
            label="Group"
            value={group}
            onChange={(v) => setGroup(v as GroupFilter)}
            options={GROUP_OPTIONS}
            className="w-40"
          />
        </>
      }
    >
      {!month ? (
        <NoRunsState />
      ) : (
        <>
          <ReportNote>
            Covers every computed or later payroll run (regular and special) with a pay date in {formatMonthLong(`${month}-01`)}.
            Headcount counts each employee once per department.
          </ReportNote>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.departmentId}
            dense
            showFooter
            hidePagination
            emptyState={{ title: "No payroll lines", description: "No employees in this group were paid in the selected month." }}
          />
          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Net pay by department</CardTitle>
                <CardDescription>
                  {formatMonthLong(`${month}-01`)}, {GROUP_OPTIONS.find((g) => g.value === group)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto w-full"
                  style={{ height: Math.max(160, rows.length * 32 + 40) }}
                  role="img"
                  aria-label="Horizontal bar chart of net pay by department"
                >
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatCurrencyCompact(pesos(v))}
                    />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} interval={0} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex w-full items-center justify-between gap-4">
                              <span className="text-muted-foreground">Net pay</span>
                              <span className="font-mono font-medium tabular-nums">{formatCurrency(pesos(Number(value)))}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="net" fill="var(--color-net)" radius={3} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </ReportLayout>
  )
}
