"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CircleDotIcon, CircleOffIcon, MinusIcon, PencilIcon, UserPlusIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { AppUser, Role } from "@/types"
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants"
import { formatDateTime, initials } from "@/lib/format"
import { can, type Permission } from "@/lib/permissions"
import { stepFor } from "@/lib/workflow"
import { uid, useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { LockNote, TabIntro } from "./settings-shared"

const ROLES: Role[] = ["hr", "accountant", "chief", "cashier", "admin"]

const PERMISSIONS: { key: Permission; label: string }[] = [
  { key: "employees.manage", label: "Manage employee records" },
  { key: "attendance.manage", label: "Manage time and attendance" },
  { key: "positions.manage", label: "Manage plantilla positions" },
  { key: "salary_schedule.manage", label: "Publish salary schedules" },
  { key: "payroll.create", label: "Create payroll runs" },
  { key: "payroll.adjust", label: "Add payroll adjustments" },
  { key: "payslips.generate", label: "Generate payslips" },
  { key: "loans.manage", label: "Manage loans and deductions" },
  { key: "remittances.manage", label: "File and pay remittances" },
  { key: "reports.export", label: "Export reports" },
  { key: "settings.manage", label: "Change settings and rate tables" },
  { key: "users.manage", label: "Manage users and roles" },
  { key: "audit.view", label: "View the audit log" },
]

const WORKFLOW_ROWS: { label: string; role: Role }[] = [
  { label: "Compute and review payroll (HR)", role: stepFor("reviewed").actor },
  { label: "Certify payroll (Accountant)", role: stepFor("certified").actor },
  { label: "Approve payroll (Chief of Hospital)", role: stepFor("approved").actor },
  { label: "Release payroll (Cashier)", role: stepFor("released").actor },
]

function schemaFor(users: readonly AppUser[], editingId?: string) {
  return z.object({
    name: z.string().trim().min(3, "Enter the full name"),
    position: z.string().trim().min(2, "Enter the position title"),
    email: z
      .email("Enter a valid email address")
      .refine((e) => !users.some((u) => u.email.toLowerCase() === e.toLowerCase() && u.id !== editingId), "Email is already in use"),
    role: z.enum(["hr", "accountant", "chief", "cashier", "admin"]),
    active: z.boolean(),
  })
}

type FormValues = z.infer<ReturnType<typeof schemaFor>>

function UserForm({ user, onDone }: { user?: AppUser; onDone: () => void }) {
  const users = useDataStore((s) => s.users)
  const upsert = useDataStore((s) => s.upsertUser)
  const schema = useMemo(() => schemaFor(users, user?.id), [users, user?.id])
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: user
      ? { name: user.name, position: user.position, email: user.email, role: user.role, active: user.active }
      : { name: "", position: "", email: "", role: "hr", active: true },
  })
  const errors = form.formState.errors
  const role = useWatch({ control: form.control, name: "role" })

  const submit = form.handleSubmit((v) => {
    upsert({
      id: user?.id ?? uid("user"),
      name: v.name,
      position: v.position,
      email: v.email,
      role: v.role,
      active: v.active,
      initials: initials(v.name),
      lastLogin: user?.lastLogin,
    })
    toast.success(user ? "User updated" : "User added", { description: `${v.name}, ${ROLE_LABELS[v.role]}` })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="user-name">Full name</FieldLabel>
          <Input id="user-name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.position}>
          <FieldLabel htmlFor="user-position">Position</FieldLabel>
          <Input id="user-position" aria-invalid={!!errors.position} {...form.register("position")} />
          <FieldError errors={[errors.position]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="user-email">Email</FieldLabel>
          <Input id="user-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="user-role">Role</FieldLabel>
          <NativeSelect id="user-role" className="w-full" {...form.register("role")}>
            {ROLES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {ROLE_LABELS[r]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{ROLE_DESCRIPTIONS[role]}</FieldDescription>
        </Field>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="user-active" checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
              <FieldLabel htmlFor="user-active">Active account</FieldLabel>
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{user ? "Save changes" : "Add user"}</Button>
      </DialogFooter>
    </form>
  )
}

function Allowed({ allowed, label }: { allowed: boolean; label: string }) {
  return allowed ? (
    <CheckIcon className="mx-auto size-4" aria-label={`${label}: allowed`} />
  ) : (
    <MinusIcon className="mx-auto size-4 text-muted-foreground/50" aria-label={`${label}: not allowed`} />
  )
}

function PermissionMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission matrix</CardTitle>
        <CardDescription>Read only. Access is defined per role; assign roles to users above.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Permission</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r} className="w-28 text-center text-xs whitespace-normal">
                    {ROLE_LABELS[r]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((p) => (
                <TableRow key={p.key}>
                  <TableCell>
                    <div className="font-medium">{p.label}</div>
                    <div className="font-mono text-[0.6875rem] text-muted-foreground">{p.key}</div>
                  </TableCell>
                  {ROLES.map((r) => (
                    <TableCell key={r} className="text-center">
                      <Allowed allowed={can(r, p.key)} label={`${ROLE_LABELS[r]}, ${p.label}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={ROLES.length + 1} className="text-xs font-semibold">
                  Payroll workflow
                </TableCell>
              </TableRow>
              {WORKFLOW_ROWS.map((w) => (
                <TableRow key={w.label}>
                  <TableCell className="font-medium">{w.label}</TableCell>
                  {ROLES.map((r) => (
                    <TableCell key={r} className="text-center">
                      <Allowed allowed={w.role === r} label={`${ROLE_LABELS[r]}, ${w.label}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

const col = createColumns<AppUser>()

export function UsersTab({ canManage }: { canManage: boolean }) {
  const users = useDataStore((s) => s.users)
  const [editing, setEditing] = useState<AppUser | "new" | null>(null)

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-[0.6875rem]">{row.original.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{row.original.name}</div>
                <div className="truncate text-xs text-muted-foreground">{row.original.position}</div>
              </div>
            </div>
          ),
          meta: { label: "Name" },
        }),
        col.accessor("email", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
          cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
          meta: { label: "Email" },
        }),
        col.accessor((u) => ROLE_LABELS[u.role], {
          id: "role",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
          cell: ({ getValue }) => <Badge variant="outline">{getValue()}</Badge>,
          filterFn: "arrHas",
          meta: { label: "Role" },
        }),
        col.accessor((u) => (u.active ? "Active" : "Inactive"), {
          id: "status",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) =>
            row.original.active ? (
              <StatusBadge label="Active" icon={CircleDotIcon} tone="solid" />
            ) : (
              <StatusBadge label="Inactive" icon={CircleOffIcon} tone="outline" className="text-muted-foreground" />
            ),
          filterFn: "arrHas",
          meta: { label: "Status" },
        }),
        col.accessor((u) => u.lastLogin ?? "", {
          id: "lastLogin",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Last login" />,
          cell: ({ getValue }) =>
            getValue() ? (
              <span className="whitespace-nowrap tabular-nums">{formatDateTime(getValue())}</span>
            ) : (
              <span className="text-muted-foreground">Never</span>
            ),
          meta: { label: "Last login" },
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
        title="Users and roles"
        description="Accounts that can sign in to PayGrade. Each user holds one role; the payroll workflow routes runs by role."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <UserPlusIcon data-icon="inline-start" aria-hidden />
              Add user
            </Button>
          ) : (
            <LockNote />
          )
        }
      />
      <DataTable
        columns={columns}
        data={users}
        getRowId={(u) => u.id}
        searchPlaceholder="Search users"
        filters={[
          { columnId: "role", title: "Role", options: ROLES.map((r) => ({ label: ROLE_LABELS[r], value: ROLE_LABELS[r] })) },
          {
            columnId: "status",
            title: "Status",
            options: [
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
            ],
          },
        ]}
        hidePagination
        dense
      />
      <PermissionMatrix />
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add user" : "Edit user"}</DialogTitle>
            <DialogDescription>Role changes take effect at the user&apos;s next sign-in.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <UserForm key={editing === "new" ? "new" : editing.id} user={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
