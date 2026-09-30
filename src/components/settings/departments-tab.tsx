"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Department } from "@/types"
import { formatNumber } from "@/lib/format"
import { uid, useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { FooterLabel as FooterLabelCell } from "@/components/reports/columns"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { LockNote, TabIntro } from "./settings-shared"

type Row = Department & { headcount: number }

function schemaFor(existing: readonly Department[], editingId?: string) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(2, "Enter a code")
      .max(5, "Use at most 5 characters")
      .regex(/^[A-Z]+$/, "Use uppercase letters only")
      .refine((c) => !existing.some((d) => d.code === c && d.id !== editingId), "Code is already used"),
    name: z.string().trim().min(2, "Enter the department name"),
    costCenter: z
      .string()
      .trim()
      .regex(/^CC-\d{3}$/, "Use the format CC-000")
      .refine((c) => !existing.some((d) => d.costCenter === c && d.id !== editingId), "Cost center is already assigned"),
    head: z.string().trim().min(3, "Enter the department head"),
  })
}

type FormValues = z.infer<ReturnType<typeof schemaFor>>

function DepartmentForm({ department, onDone }: { department?: Department; onDone: () => void }) {
  const departments = useDataStore((s) => s.departments)
  const upsert = useDataStore((s) => s.upsertDepartment)
  const schema = useMemo(() => schemaFor(departments, department?.id), [departments, department?.id])
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: department ?? { code: "", name: "", costCenter: "CC-", head: "" },
  })
  const errors = form.formState.errors

  const submit = form.handleSubmit((v) => {
    upsert({ id: department?.id ?? uid("dept"), ...v })
    toast.success(department ? "Department updated" : "Department added", { description: v.name })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="dept-code">Code</FieldLabel>
            <Input
              id="dept-code"
              className="font-mono uppercase"
              aria-invalid={!!errors.code}
              {...form.register("code", { setValueAs: (v: string) => v.toUpperCase() })}
            />
            <FieldError errors={[errors.code]} />
          </Field>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="dept-name">Name</FieldLabel>
            <Input id="dept-name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <Field data-invalid={!!errors.costCenter}>
            <FieldLabel htmlFor="dept-cc">Cost center</FieldLabel>
            <Input id="dept-cc" className="font-mono" aria-invalid={!!errors.costCenter} {...form.register("costCenter")} />
            <FieldError errors={[errors.costCenter]} />
          </Field>
          <Field data-invalid={!!errors.head}>
            <FieldLabel htmlFor="dept-head">Department head</FieldLabel>
            <Input id="dept-head" aria-invalid={!!errors.head} {...form.register("head")} />
            <FieldError errors={[errors.head]} />
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{department ? "Save changes" : "Add department"}</Button>
      </DialogFooter>
    </form>
  )
}

const col = createColumns<Row>()

export function DepartmentsTab({ canManage }: { canManage: boolean }) {
  const departments = useDataStore((s) => s.departments)
  const employees = useDataStore((s) => s.employees)
  const [editing, setEditing] = useState<Department | "new" | null>(null)

  const rows = useMemo<Row[]>(() => {
    const counts = new Map<string, number>()
    for (const e of employees) {
      if (e.status === "separated") continue
      counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1)
    }
    return departments.map((d) => ({ ...d, headcount: counts.get(d.id) ?? 0 }))
  }, [departments, employees])

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("code", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
          cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
          footer: () => <FooterLabelCell>Total</FooterLabelCell>,
          meta: { label: "Code" },
        }),
        col.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
          footer: ({ table }) => <FooterLabelCell>{table.getFilteredRowModel().rows.length} departments</FooterLabelCell>,
          meta: { label: "Name" },
        }),
        col.accessor("costCenter", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Cost center" />,
          cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
          meta: { label: "Cost center" },
        }),
        col.accessor("head", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Head" />,
          meta: { label: "Head" },
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
        ...(canManage
          ? [
              col.display({
                id: "actions",
                enableHiding: false,
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => (
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.name}`}>
                    <PencilIcon />
                  </Button>
                ),
                meta: { cellClassName: "w-10" },
              }),
            ]
          : []),
      ]),
    [canManage]
  )

  return (
    <div className="flex flex-col gap-4">
      <TabIntro
        title="Departments and cost centers"
        description="Organizational units used for payroll grouping, cost allocation, and the summary by department report. Headcount excludes separated employees."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              Add department
            </Button>
          ) : (
            <LockNote />
          )
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(d) => d.id}
        searchPlaceholder="Search departments"
        initialSorting={[{ id: "code", desc: false }]}
        showFooter
        hidePagination
        dense
      />
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add department" : "Edit department"}</DialogTitle>
            <DialogDescription>Department codes and cost centers must be unique.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <DepartmentForm
              key={editing === "new" ? "new" : editing.id}
              department={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
