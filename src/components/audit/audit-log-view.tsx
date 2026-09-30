"use client"

import { useMemo, useState } from "react"
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon, ScrollTextIcon } from "lucide-react"

import type { AuditEntity, AuditEntry, Role } from "@/types"
import { ROLE_LABELS } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { useMockExport } from "@/hooks/use-mock-export"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { AuditDetailSheet } from "./audit-detail-sheet"
import { changeSummary, DATE_RANGE_LABELS, ENTITY_LABELS, filterByRange, type DateRange } from "./audit-labels"

const col = createColumns<AuditEntry>()

const columns = col.columns([
  col.accessor((e) => Date.parse(e.at), {
    id: "at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.original.at)}</span>,
    meta: { label: "Timestamp" },
  }),
  col.accessor("userName", {
    id: "user",
    header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span>,
    filterFn: "arrHas",
    meta: { label: "User" },
  }),
  col.accessor((e) => e.role, {
    id: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ getValue }) => (
      <Badge variant="outline" className="font-normal">
        {ROLE_LABELS[getValue()]}
      </Badge>
    ),
    filterFn: "arrHas",
    meta: { label: "Role" },
  }),
  col.accessor("action", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    meta: { label: "Action" },
  }),
  col.accessor((e) => e.entity, {
    id: "entity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Entity" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{ENTITY_LABELS[getValue()]}</span>,
    filterFn: "arrHas",
    meta: { label: "Entity" },
  }),
  col.accessor("entityLabel", {
    id: "record",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Record" />,
    cell: ({ getValue }) => (
      <span className="block max-w-64 truncate" title={getValue()}>
        {getValue()}
      </span>
    ),
    meta: { label: "Record" },
  }),
  col.accessor((e) => changeSummary(e.before, e.after), {
    id: "change",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Change summary" />,
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="block max-w-80 truncate font-mono text-xs text-muted-foreground" title={getValue()}>
          {getValue()}
        </span>
      ) : (
        <span className="text-muted-foreground/50">None</span>
      ),
    meta: { label: "Change summary" },
  }),
])

const RANGES: DateRange[] = ["all", "7d", "30d"]

export function AuditLogView() {
  const audit = useDataStore((s) => s.audit)
  const exportFile = useMockExport()
  const [range, setRange] = useState<DateRange>("all")
  const [selected, setSelected] = useState<AuditEntry | null>(null)

  const rows = useMemo(() => filterByRange(audit, range), [audit, range])

  const filters = useMemo(() => {
    const users = Array.from(new Set(audit.map((e) => e.userName))).sort()
    const roles = Array.from(new Set(audit.map((e) => e.role))) as Role[]
    const entities = Array.from(new Set(audit.map((e) => e.entity))) as AuditEntity[]
    return [
      { columnId: "role", title: "Role", options: roles.map((r) => ({ label: ROLE_LABELS[r], value: r })) },
      {
        columnId: "entity",
        title: "Entity",
        options: entities
          .map((e) => ({ label: ENTITY_LABELS[e], value: e }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
      { columnId: "user", title: "User", options: users.map((u) => ({ label: u, value: u })) },
    ]
  }, [audit])

  const runExport = (format: "CSV" | "PDF") =>
    exportFile({
      title: "Audit log",
      format,
      fileStem: `audit-log-${range === "all" ? "all-time" : `last-${range}`}`,
      rows: rows.length,
      entity: "audit",
      entityId: "audit-log",
    })

  return (
    <PageContainer>
      <PageHeader
        title="Audit Log"
        description="Append-only record of every change to employees, payroll runs, rates, settings, and user access."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{rows.length} entries</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runExport("CSV")}>
                  <FileSpreadsheetIcon aria-hidden />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("PDF")}>
                  <FileTextIcon aria-hidden />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <DataTable
        key={range}
        columns={columns}
        data={rows}
        getRowId={(e) => e.id}
        searchPlaceholder="Search audit log"
        filters={filters}
        toolbar={
          <ToggleGroup
            aria-label="Date range"
            variant="outline"
            size="sm"
            spacing={0}
            value={[range]}
            onValueChange={(value: string[]) => {
              const next = value[0] as DateRange | undefined
              if (next) setRange(next)
            }}
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r} value={r} className="h-8 px-2.5 text-xs">
                {DATE_RANGE_LABELS[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
        onRowClick={setSelected}
        rowLabel={(e) => `${e.action}, ${e.entityLabel}, ${formatDateTime(e.at)}. Open details.`}
        activeRowId={selected?.id}
        pageSize={50}
        dense
        emptyState={{
          icon: <ScrollTextIcon />,
          title: "No audit entries",
          description: "Changes made in PayGrade will appear here.",
        }}
      />
      <AuditDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </PageContainer>
  )
}
