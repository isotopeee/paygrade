"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon, PlusIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { AllowanceType } from "@/types"
import { formatCurrency } from "@/lib/format"
import { pesos, toPesos } from "@/lib/payroll/money"
import { uid, useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"

import { LockNote, TabIntro } from "./settings-shared"

const APPLIES_LABELS: Record<AllowanceType["appliesTo"], string> = {
  plantilla: "Plantilla",
  jo_cos: "JO/COS",
  all: "All employees",
}

function schemaFor(existing: readonly AllowanceType[], editingId?: string) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, "Enter a code")
      .max(6, "Use at most 6 characters")
      .regex(/^[A-Z0-9]+$/, "Use uppercase letters and digits only")
      .refine((c) => !existing.some((a) => a.code === c && a.id !== editingId), "Code is already used"),
    name: z.string().trim().min(3, "Enter the allowance name"),
    defaultMonthly: z.number({ error: "Enter an amount" }).min(0, "Amount cannot be negative"),
    taxable: z.boolean(),
    appliesTo: z.enum(["plantilla", "jo_cos", "all"]),
    legalBasis: z.string().trim().min(3, "Enter the legal basis"),
    active: z.boolean(),
  })
}

type FormValues = z.infer<ReturnType<typeof schemaFor>>

function AllowanceForm({ allowance, onDone }: { allowance?: AllowanceType; onDone: () => void }) {
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const upsert = useDataStore((s) => s.upsertAllowanceType)
  const schema = useMemo(() => schemaFor(allowanceTypes, allowance?.id), [allowanceTypes, allowance?.id])
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: allowance
      ? { ...allowance, defaultMonthly: toPesos(allowance.defaultMonthly) }
      : { code: "", name: "", defaultMonthly: 0, taxable: false, appliesTo: "plantilla", legalBasis: "", active: true },
  })
  const errors = form.formState.errors

  const submit = form.handleSubmit((v) => {
    upsert({
      id: allowance?.id ?? uid("alw"),
      code: v.code,
      name: v.name,
      defaultMonthly: pesos(v.defaultMonthly),
      taxable: v.taxable,
      appliesTo: v.appliesTo,
      legalBasis: v.legalBasis,
      active: v.active,
    })
    toast.success(allowance ? "Allowance type updated" : "Allowance type added", { description: v.name })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="alw-code">Code</FieldLabel>
            <Input id="alw-code" className="font-mono uppercase" aria-invalid={!!errors.code} {...form.register("code", { setValueAs: (v: string) => v.toUpperCase() })} />
            <FieldError errors={[errors.code]} />
          </Field>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="alw-name">Name</FieldLabel>
            <Input id="alw-name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.defaultMonthly}>
            <FieldLabel htmlFor="alw-amount">Default monthly amount</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>₱</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="alw-amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                aria-invalid={!!errors.defaultMonthly}
                {...form.register("defaultMonthly", { valueAsNumber: true })}
              />
            </InputGroup>
            <FieldDescription>Use 0 when computed per employee.</FieldDescription>
            <FieldError errors={[errors.defaultMonthly]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="alw-applies">Applies to</FieldLabel>
            <NativeSelect id="alw-applies" className="w-full" {...form.register("appliesTo")}>
              {Object.entries(APPLIES_LABELS).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field data-invalid={!!errors.legalBasis}>
          <FieldLabel htmlFor="alw-basis">Legal basis</FieldLabel>
          <Input id="alw-basis" aria-invalid={!!errors.legalBasis} {...form.register("legalBasis")} />
          <FieldError errors={[errors.legalBasis]} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="taxable"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="alw-taxable" checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
                <FieldLabel htmlFor="alw-taxable">Taxable</FieldLabel>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="alw-active" checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
                <FieldLabel htmlFor="alw-active">Active</FieldLabel>
              </Field>
            )}
          />
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{allowance ? "Save changes" : "Add allowance"}</Button>
      </DialogFooter>
    </form>
  )
}

const col = createColumns<AllowanceType>()

export function AllowancesTab({ canManage }: { canManage: boolean }) {
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const upsert = useDataStore((s) => s.upsertAllowanceType)
  const [editing, setEditing] = useState<AllowanceType | "new" | null>(null)

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("code", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
          cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
          meta: { label: "Code" },
        }),
        col.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
          meta: { label: "Name" },
        }),
        col.accessor("defaultMonthly", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Default monthly" />,
          cell: ({ getValue }) =>
            getValue() === 0 ? <span className="text-muted-foreground">Computed</span> : formatCurrency(getValue()),
          meta: { numeric: true, label: "Default monthly" },
        }),
        col.accessor((a) => (a.taxable ? "Yes" : "No"), {
          id: "taxable",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Taxable" />,
          cell: ({ getValue }) => (
            <Badge variant={getValue() === "Yes" ? "secondary" : "outline"}>{getValue()}</Badge>
          ),
          meta: { label: "Taxable" },
        }),
        col.accessor((a) => APPLIES_LABELS[a.appliesTo], {
          id: "appliesTo",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Applies to" />,
          meta: { label: "Applies to" },
        }),
        col.accessor("legalBasis", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Legal basis" />,
          cell: ({ getValue }) => <span className="block max-w-72 truncate text-muted-foreground" title={getValue()}>{getValue()}</span>,
          meta: { label: "Legal basis" },
        }),
        col.accessor("active", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Active" />,
          cell: ({ row }) =>
            canManage ? (
              <Switch
                checked={row.original.active}
                onCheckedChange={(checked) => {
                  upsert({ ...row.original, active: checked })
                  toast.success(`${row.original.name} ${checked ? "activated" : "deactivated"}`)
                }}
                aria-label={`${row.original.name} active`}
              />
            ) : (
              <Badge variant={row.original.active ? "default" : "outline"}>{row.original.active ? "Active" : "Inactive"}</Badge>
            ),
          meta: { label: "Active" },
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
    [canManage, upsert]
  )

  return (
    <div className="flex flex-col gap-4">
      <TabIntro
        title="Allowances and benefits"
        description="Allowance types available for assignment to employees. Taxability drives withholding tax and BIR Form 2316 classification."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              Add allowance
            </Button>
          ) : (
            <LockNote />
          )
        }
      />
      <DataTable columns={columns} data={allowanceTypes} getRowId={(a) => a.id} searchPlaceholder="Search allowances" hidePagination dense />
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add allowance type" : "Edit allowance type"}</DialogTitle>
            <DialogDescription>Changes apply to payroll computed after saving.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <AllowanceForm
              key={editing === "new" ? "new" : editing.id}
              allowance={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
