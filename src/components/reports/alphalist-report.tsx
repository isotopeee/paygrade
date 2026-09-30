"use client"

import { useMemo, useState } from "react"

import { GROUP_LABELS } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { buildAlphalist, type AlphalistRow, type ReportMeta } from "@/lib/reports"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"

import { amountColumn, FooterLabel } from "./columns"
import { FilterSelect, ReportLayout, ReportNote } from "./report-layout"

const YEAR = DEMO_TODAY.slice(0, 4)
const AS_OF = `${DEMO_TODAY.slice(0, 7)}-30`

const col = createColumns<AlphalistRow>()

const columns = col.columns([
  col.accessor("tin", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="TIN" />,
    cell: ({ getValue }) => <span className="font-mono text-xs whitespace-nowrap">{getValue()}</span>,
    footer: () => <FooterLabel>Totals</FooterLabel>,
    meta: { label: "TIN" },
  }),
  col.accessor("lastName", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last name" />,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    footer: ({ table }) => <FooterLabel>{table.getFilteredRowModel().rows.length} employees</FooterLabel>,
    meta: { label: "Last name" },
  }),
  col.accessor("firstName", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="First name" />,
    meta: { label: "First name" },
  }),
  col.accessor("middleName", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Middle name" />,
    meta: { label: "Middle name" },
  }),
  col.accessor((r) => r.group, {
    id: "group",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Group" />,
    cell: ({ getValue }) => <span className="text-muted-foreground">{GROUP_LABELS[getValue()]}</span>,
    filterFn: "arrHas",
    meta: { label: "Group" },
  }),
  amountColumn(col, "gross", "Gross compensation"),
  amountColumn(col, "nonTaxable", "Non-taxable"),
  amountColumn(col, "taxable", "Taxable"),
  amountColumn(col, "taxWithheld", "Tax withheld", { emphasize: true }),
])

const GROUP_FILTER = [
  { label: GROUP_LABELS.plantilla, value: "plantilla" },
  { label: GROUP_LABELS.jo_cos, value: "jo_cos" },
]

export function AlphalistReport({ meta }: { meta: ReportMeta }) {
  const employees = useDataStore((s) => s.employees)
  const runs = useDataStore((s) => s.runs)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const [year, setYear] = useState(YEAR)
  const rows = useMemo(
    () => buildAlphalist({ employees, runs, allowanceTypes, year, asOf: AS_OF }),
    [employees, runs, allowanceTypes, year]
  )

  return (
    <ReportLayout
      meta={meta}
      fileStem={`alphalist-${year}-ytd`}
      rows={rows.length}
      filters={
        <>
          <FilterSelect id="al-year" label="Year" value={year} onChange={setYear} options={[{ value: YEAR, label: YEAR }]} className="w-28" />
          <p className="pb-1.5 text-xs text-muted-foreground">Year to date, Jan 1 to {formatDate(AS_OF)}</p>
        </>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.employeeId}
        searchPlaceholder="Search by name or TIN"
        filters={[{ columnId: "group", title: "Group", options: GROUP_FILTER }]}
        initialSorting={[{ id: "lastName", desc: false }]}
        dense
        showFooter
        pageSize={50}
        emptyState={{ title: "No compensation paid", description: `No computed payroll lines in ${year}.` }}
      />
      <ReportNote>
        Non-taxable compensation covers PERA, RATA, de minimis benefits, mandatory contributions, and 13th month pay and other
        benefits up to the annual ceiling. JO/COS amounts are contract payments, listed for reference.
      </ReportNote>
    </ReportLayout>
  )
}
