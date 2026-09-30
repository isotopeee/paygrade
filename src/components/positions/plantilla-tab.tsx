"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  BriefcaseBusinessIcon,
  CircleDashedIcon,
  CircleDotIcon,
  PencilIcon,
  PercentIcon,
  PlusIcon,
  UserCheckIcon,
} from "lucide-react"

import type { Position } from "@/types"
import { formatDate, fullName } from "@/lib/format"
import { can } from "@/lib/permissions"
import { byId } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"

import { PositionDialog } from "./position-dialog"

interface PositionRow {
  position: Position
  itemNo: string
  title: string
  salaryGrade: number
  department: string
  departmentName: string
  incumbentId?: string
  incumbentName?: string
  status: "filled" | "vacant"
  dateCreated: string
  authorization: string
}

const col = createColumns<PositionRow>()

export function PlantillaTab() {
  const role = useRole()
  const positions = useDataStore((s) => s.positions)
  const employees = useDataStore((s) => s.employees)
  const departments = useDataStore((s) => s.departments)
  const canManage = can(role, "positions.manage")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Position | undefined>(undefined)

  const rows = useMemo<PositionRow[]>(() => {
    const employeesById = byId(employees)
    const departmentsById = byId(departments)
    return positions.map((p) => {
      const incumbent = p.employeeId ? employeesById.get(p.employeeId) : undefined
      return {
        position: p,
        itemNo: p.itemNo,
        title: p.title,
        salaryGrade: p.salaryGrade,
        department: p.departmentId,
        departmentName: departmentsById.get(p.departmentId)?.name ?? p.departmentId,
        incumbentId: incumbent?.id,
        incumbentName: incumbent ? fullName(incumbent) : undefined,
        status: incumbent ? "filled" : "vacant",
        dateCreated: p.dateCreated,
        authorization: p.authorization,
      }
    })
  }, [positions, employees, departments])

  const filled = rows.filter((r) => r.status === "filled").length
  const vacant = rows.length - filled
  const fillRate = rows.length > 0 ? (filled / rows.length) * 100 : 0

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("itemNo", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Item No." />,
          cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
          meta: { label: "Item No." },
        }),
        col.accessor("title", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Position title" />,
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
          meta: { label: "Position title" },
        }),
        col.accessor("salaryGrade", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="SG" />,
          meta: { label: "Salary grade", numeric: true },
        }),
        col.accessor("department", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
          cell: ({ row }) => row.original.departmentName,
          filterFn: "arrHas",
          meta: { label: "Department" },
        }),
        col.accessor((row) => row.incumbentName ?? "Vacant", {
          id: "incumbent",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Incumbent" />,
          cell: ({ row }) =>
            row.original.incumbentId ? (
              <Link
                href={`/employees/${row.original.incumbentId}`}
                className="underline-offset-4 hover:underline focus-visible:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.incumbentName}
              </Link>
            ) : (
              <span className="text-muted-foreground">Vacant</span>
            ),
          meta: { label: "Incumbent" },
        }),
        col.accessor("status", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ getValue }) =>
            getValue() === "filled" ? (
              <StatusBadge label="Filled" icon={CircleDotIcon} tone="solid" />
            ) : (
              <StatusBadge label="Vacant" icon={CircleDashedIcon} tone="outline" />
            ),
          filterFn: "arrHas",
          meta: { label: "Status" },
        }),
        col.accessor("dateCreated", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Date created" />,
          cell: ({ getValue }) => <span className="tabular-nums">{formatDate(getValue())}</span>,
          meta: { label: "Date created" },
        }),
        col.accessor("authorization", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Authorization" />,
          cell: ({ getValue }) => (
            <span className="block max-w-64 truncate text-muted-foreground" title={getValue()}>
              {getValue()}
            </span>
          ),
          meta: { label: "Authorization" },
        }),
        ...(canManage
          ? [
              col.display({
                id: "actions",
                enableHiding: false,
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${row.original.itemNo}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(row.original.position)
                      setDialogOpen(true)
                    }}
                  >
                    <PencilIcon />
                  </Button>
                ),
                meta: { align: "right", cellClassName: "w-10" },
              }),
            ]
          : []),
      ]),
    [canManage]
  )

  const departmentOptions = useMemo(() => {
    const used = new Set(positions.map((p) => p.departmentId))
    return departments.filter((d) => used.has(d.id)).map((d) => ({ label: d.name, value: d.id }))
  }, [positions, departments])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total plantilla items" value={rows.length} icon={BriefcaseBusinessIcon} hint="Authorized positions" />
        <StatCard label="Filled" value={filled} icon={UserCheckIcon} hint="With an appointed incumbent" />
        <StatCard label="Vacant" value={vacant} icon={CircleDashedIcon} hint="Unfilled items for recruitment" />
        <StatCard label="Fill rate" value={`${fillRate.toFixed(1)}%`} icon={PercentIcon} hint={`${filled} of ${rows.length} items`} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.position.id}
        searchPlaceholder="Search item no., title, incumbent"
        filters={[
          { columnId: "department", title: "Department", options: departmentOptions },
          {
            columnId: "status",
            title: "Status",
            options: [
              { label: "Filled", value: "filled", icon: CircleDotIcon },
              { label: "Vacant", value: "vacant", icon: CircleDashedIcon },
            ],
          },
        ]}
        initialSorting={[{ id: "itemNo", desc: false }]}
        toolbar={
          canManage ? (
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                setEditing(undefined)
                setDialogOpen(true)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              Create position
            </Button>
          ) : undefined
        }
        emptyState={{ title: "No plantilla items", description: "Create a position to start building the plantilla." }}
      />

      <PositionDialog open={dialogOpen} onOpenChange={setDialogOpen} position={editing} />
    </div>
  )
}
