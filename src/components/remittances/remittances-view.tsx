"use client"

import * as React from "react"
import {
  BanknoteIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  ClockIcon,
  DownloadIcon,
  FileCheckIcon,
  MoreHorizontalIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
} from "lucide-react"

import type { Agency, Remittance } from "@/types"
import { AGENCY_FULL, AGENCY_LABELS, REMITTANCE_STATUS_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatMonth, formatMonthLong, formatNumber } from "@/lib/format"
import { can } from "@/lib/permissions"
import { AGENCIES, deriveRemittances } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { useMockExport } from "@/hooks/use-mock-export"
import { DataTable, DataTableColumnHeader, createColumns, type AppTable } from "@/components/data-table"
import { Money } from "@/components/money"
import { PageContainer, PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { RemittanceStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AGENCY_DESCRIPTIONS, AGENCY_EXPORTS, isOverdue } from "./agency-meta"
import { FilingDialog, type FilingMode } from "./filing-dialog"
import { OverdueBadge } from "./overdue-badge"
import { RemittanceSheet } from "./remittance-sheet"

interface RemittanceRow extends Remittance {
  total: number
  statusLabel: string
}

interface RowActions {
  canManage: boolean
  onFiling: (row: RemittanceRow, mode: FilingMode) => void
  onExport: (row: RemittanceRow) => void
}

function ActionsCell({ row, actions }: { row: RemittanceRow; actions: RowActions }) {
  const label = `${AGENCY_LABELS[row.agency]}, ${formatMonthLong(row.month)}`
  return (
    // Stop clicks and keys (including those from the portalled menu) from reaching the row.
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`} />}
        >
          <MoreHorizontalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {actions.canManage && (
              <>
                <DropdownMenuItem disabled={row.status !== "pending"} onClick={() => actions.onFiling(row, "filed")}>
                  <FileCheckIcon aria-hidden />
                  Mark as filed
                </DropdownMenuItem>
                <DropdownMenuItem disabled={row.status === "paid"} onClick={() => actions.onFiling(row, "paid")}>
                  <CheckCheckIcon aria-hidden />
                  Mark as paid
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
          {actions.canManage && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => actions.onExport(row)}>
              <DownloadIcon aria-hidden />
              Export schedule
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function buildColumns(agency: Agency, actions: RowActions) {
  const col = createColumns<RemittanceRow>()
  const isBir = agency === "bir"
  const sumFooter = (pick: (r: RemittanceRow) => number) =>
    function Footer({ table }: { table: AppTable<RemittanceRow> }) {
      const total = table.getFilteredRowModel().rows.reduce((n, r) => n + pick(r.original), 0)
      return <Money value={total} plain />
    }

  return col.columns([
    col.accessor("month", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Month" />,
      cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{formatMonth(getValue())}</span>,
      footer: () => <span>Total</span>,
      meta: { label: "Month" },
    }),
    col.accessor("headcount", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Headcount" />,
      cell: ({ getValue }) => formatNumber(getValue()),
      meta: { numeric: true, label: "Headcount" },
    }),
    col.accessor("employeeShare", {
      header: ({ column }) => <DataTableColumnHeader column={column} title={isBir ? "Tax withheld" : "Employee share"} />,
      cell: ({ getValue }) => <Money value={getValue()} plain />,
      footer: sumFooter((r) => r.employeeShare),
      meta: { numeric: true, label: isBir ? "Tax withheld" : "Employee share" },
    }),
    ...(isBir
      ? []
      : [
          col.accessor("governmentShare", {
            header: ({ column }) => <DataTableColumnHeader column={column} title="Government share" />,
            cell: ({ getValue }) => <Money value={getValue()} plain />,
            footer: sumFooter((r) => r.governmentShare),
            meta: { numeric: true, label: "Government share" },
          }),
          col.accessor("total", {
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            cell: ({ getValue }) => <Money value={getValue()} plain className="font-medium" />,
            footer: sumFooter((r) => r.total),
            meta: { numeric: true, label: "Total" },
          }),
        ]),
    col.accessor("dueDate", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due date" />,
      cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{formatDate(getValue())}</span>,
      meta: { label: "Due date" },
    }),
    col.accessor("statusLabel", {
      id: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      filterFn: "arrHas",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <RemittanceStatusBadge status={row.original.status} />
          <OverdueBadge remittance={row.original} />
        </div>
      ),
      meta: { label: "Status" },
    }),
    col.accessor((r) => r.referenceNo ?? "", {
      id: "referenceNo",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reference No." />,
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="font-mono text-xs whitespace-nowrap">{getValue()}</span>
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
      meta: { label: "Reference No." },
    }),
    col.accessor((r) => r.filedAt ?? "", {
      id: "filedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Filed on" />,
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap tabular-nums">
          {getValue() ? formatDate(getValue()) : <span className="text-muted-foreground">Not filed</span>}
        </span>
      ),
      meta: { label: "Filed on" },
    }),
    col.accessor((r) => r.paidAt ?? "", {
      id: "paidAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paid on" />,
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap tabular-nums">
          {getValue() ? formatDate(getValue()) : <span className="text-muted-foreground">Not paid</span>}
        </span>
      ),
      meta: { label: "Paid on" },
    }),
    col.display({
      id: "actions",
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionsCell row={row.original} actions={actions} />,
      meta: { cellClassName: "w-10", headerClassName: "w-10" },
    }),
  ])
}

const STATUS_OPTIONS = (["pending", "filed", "paid"] as const).map((s) => ({
  label: REMITTANCE_STATUS_LABELS[s],
  value: REMITTANCE_STATUS_LABELS[s],
}))

function AgencyPanel({
  agency,
  remittances,
  canManage,
  onFiling,
}: {
  agency: Agency
  remittances: Remittance[]
  canManage: boolean
  onFiling: (row: Remittance, mode: FilingMode) => void
}) {
  const exportFile = useMockExport()
  const [sheetId, setSheetId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const rows = React.useMemo<RemittanceRow[]>(
    () =>
      remittances
        .filter((r) => r.agency === agency)
        .map((r) => ({ ...r, total: r.employeeShare + r.governmentShare, statusLabel: REMITTANCE_STATUS_LABELS[r.status] })),
    [remittances, agency]
  )

  const stats = React.useMemo(() => {
    const latest = rows.reduce<RemittanceRow | undefined>((a, r) => (!a || r.month > a.month ? r : a), undefined)
    const paid2026 = rows.filter((r) => r.status === "paid" && (r.paidAt ?? "").startsWith("2026"))
    return {
      latest,
      pending: rows.filter((r) => r.status === "pending").length,
      filed: rows.filter((r) => r.status === "filed").length,
      remitted: paid2026.reduce((n, r) => n + r.total, 0),
      remittedCount: paid2026.length,
      overdue: rows.filter(isOverdue),
    }
  }, [rows])

  const exportFirst = React.useCallback(
    (row: RemittanceRow) => {
      const x = AGENCY_EXPORTS[agency][0]
      if (!x) return
      exportFile({
        title: `${x.title}, ${formatMonthLong(row.month)}`,
        format: x.format,
        fileStem: `${x.stem}-${row.month.slice(0, 7)}`,
        entity: "remittance",
        entityId: row.id,
        rows: row.headcount,
      })
    },
    [agency, exportFile]
  )

  const columns = React.useMemo(
    () => buildColumns(agency, { canManage, onFiling, onExport: exportFirst }),
    [agency, canManage, onFiling, exportFirst]
  )

  const selected = sheetId ? rows.find((r) => r.id === sheetId) : undefined
  const isBir = agency === "bir"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{AGENCY_FULL[agency]}</h2>
        <p className="max-w-3xl text-xs text-muted-foreground">{AGENCY_DESCRIPTIONS[agency]}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={stats.latest ? `Amount due, ${formatMonth(stats.latest.month)}` : "Amount due"}
          value={formatCurrency(stats.latest?.total ?? 0)}
          icon={BanknoteIcon}
          hint={
            stats.latest
              ? `Due ${formatDate(stats.latest.dueDate)}, ${REMITTANCE_STATUS_LABELS[stats.latest.status].toLowerCase()}`
              : "No remittances yet"
          }
        />
        <StatCard
          label="Pending"
          value={formatNumber(stats.pending)}
          icon={ClockIcon}
          hint={`${formatNumber(stats.filed)} filed and awaiting payment`}
        />
        <StatCard
          label={isBir ? "Tax remitted, 2026 to date" : "Remitted, 2026 to date"}
          value={formatCurrency(stats.remitted)}
          icon={ReceiptTextIcon}
          hint={`${formatNumber(stats.remittedCount)} monthly remittances paid`}
        />
        <StatCard
          label="Overdue"
          value={formatNumber(stats.overdue.length)}
          icon={stats.overdue.length > 0 ? TriangleAlertIcon : CalendarClockIcon}
          hint={
            stats.overdue.length > 0
              ? `Oldest due ${formatDate(stats.overdue.reduce((a, r) => (r.dueDate < a ? r.dueDate : a), stats.overdue[0]?.dueDate ?? ""))}`
              : "All remittances are within their due dates"
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        dense
        showFooter
        hidePagination
        filters={[{ columnId: "status", title: "Status", options: STATUS_OPTIONS }]}
        initialSorting={[{ id: "month", desc: true }]}
        onRowClick={(row) => {
          setSheetId(row.id)
          setSheetOpen(true)
        }}
        rowLabel={(row) => `Open ${AGENCY_LABELS[row.agency]} schedule for ${formatMonthLong(row.month)}`}
        activeRowId={sheetOpen ? (sheetId ?? undefined) : undefined}
        maxHeightClassName="max-h-[calc(100svh-24rem)] min-h-64"
        emptyState={{
          icon: <ReceiptTextIcon />,
          title: "No remittances",
          description: "Monthly remittances appear once payroll runs are computed.",
        }}
      />

      <RemittanceSheet remittance={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}

export function RemittancesView() {
  const role = useRole()
  const runs = useDataStore((s) => s.runs)
  const filings = useDataStore((s) => s.remittanceFilings)
  const [agency, setAgency] = React.useState<Agency>("gsis")
  const [filing, setFiling] = React.useState<{ remittance: Remittance; mode: FilingMode } | null>(null)
  const canManage = can(role, "remittances.manage")

  const remittances = React.useMemo(() => deriveRemittances(runs, filings), [runs, filings])
  const onFiling = React.useCallback((remittance: Remittance, mode: FilingMode) => setFiling({ remittance, mode }), [])

  const overdueByAgency = React.useMemo(() => {
    const map = new Map<Agency, number>()
    for (const r of remittances) if (isOverdue(r)) map.set(r.agency, (map.get(r.agency) ?? 0) + 1)
    return map
  }, [remittances])

  return (
    <PageContainer>
      <PageHeader
        title="Remittances"
        description="Monthly GSIS, PhilHealth, Pag-IBIG, and BIR remittances derived from payroll, with filing and payment tracking."
        actions={
          !canManage ? (
            <span className="text-xs text-muted-foreground">Only the Accountant can record filings and payments.</span>
          ) : undefined
        }
      />

      <Tabs value={agency} onValueChange={(value) => setAgency(value as Agency)}>
        <TabsList aria-label="Remitting agency">
          {AGENCIES.map((a) => (
            <TabsTrigger key={a} value={a} className="px-3">
              {a === "bir" ? "BIR (1601-C)" : AGENCY_LABELS[a]}
              {(overdueByAgency.get(a) ?? 0) > 0 && (
                <TriangleAlertIcon className="size-3.5" aria-label={`${overdueByAgency.get(a)} overdue`} />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {AGENCIES.map((a) => (
          <TabsContent key={a} value={a} className="pt-3">
            <AgencyPanel agency={a} remittances={remittances} canManage={canManage} onFiling={onFiling} />
          </TabsContent>
        ))}
      </Tabs>

      {filing && (
        <FilingDialog
          key={`${filing.remittance.id}-${filing.mode}`}
          remittance={filing.remittance}
          mode={filing.mode}
          onClose={() => setFiling(null)}
        />
      )}
    </PageContainer>
  )
}
