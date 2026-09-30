"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { DtrSummary, Employee, PayrollPeriod } from "@/types"
import { formatPeriod, fullName } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const decimal = (label: string, step: "half" | "any" | "whole") =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .regex(/^\d+(\.\d{1,2})?$/, `${label[0]?.toUpperCase()}${label.slice(1)} must be a non-negative number`)
    .refine(
      (v) => (step === "whole" ? Number.isInteger(Number(v)) : step === "half" ? (Number(v) * 2) % 1 === 0 : true),
      step === "whole" ? "Use whole minutes" : "Use whole or half days"
    )

function buildSchema(daysRequired: number) {
  return z
    .object({
      daysWorked: decimal("days worked", "half"),
      leaveWithPayDays: decimal("leave with pay", "half"),
      absencesWithoutPay: decimal("absences", "half"),
      tardinessMinutes: decimal("tardiness minutes", "whole"),
      undertimeMinutes: decimal("undertime minutes", "whole"),
      overtimeHoursRegular: decimal("regular overtime hours", "any"),
      overtimeHoursRestDay: decimal("rest day overtime hours", "any"),
      nightDiffHours: decimal("night differential hours", "any"),
    })
    .superRefine((v, ctx) => {
      const total = Number(v.daysWorked) + Number(v.leaveWithPayDays) + Number(v.absencesWithoutPay)
      if (total > daysRequired) {
        ctx.addIssue({
          code: "custom",
          path: ["daysWorked"],
          message: `Days worked, leave, and absences total ${total}, more than the ${daysRequired} days required`,
        })
      }
    })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

const FIELDS: { name: keyof FormValues; label: string; unit: string }[] = [
  { name: "daysWorked", label: "Days worked", unit: "days" },
  { name: "leaveWithPayDays", label: "Leave with pay", unit: "days" },
  { name: "absencesWithoutPay", label: "Absences (LWOP)", unit: "days" },
  { name: "tardinessMinutes", label: "Tardiness", unit: "minutes" },
  { name: "undertimeMinutes", label: "Undertime", unit: "minutes" },
  { name: "overtimeHoursRegular", label: "Overtime, regular day", unit: "hours" },
  { name: "overtimeHoursRestDay", label: "Overtime, rest day", unit: "hours" },
  { name: "nightDiffHours", label: "Night differential", unit: "hours" },
]

export function DtrEditDialog({
  open,
  onOpenChange,
  employee,
  period,
  summary,
  daysRequired,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
  period: PayrollPeriod
  summary?: DtrSummary
  daysRequired: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{summary ? "Edit DTR summary" : "Create manual DTR entry"}</DialogTitle>
          <DialogDescription>
            {fullName(employee)}, {formatPeriod(period.start, period.end)}. {daysRequired} working days required. Saved as a
            manual entry and recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <DtrEditForm
          employee={employee}
          period={period}
          summary={summary}
          daysRequired={daysRequired}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function DtrEditForm({
  employee,
  period,
  summary,
  daysRequired,
  onDone,
}: {
  employee: Employee
  period: PayrollPeriod
  summary?: DtrSummary
  daysRequired: number
  onDone: () => void
}) {
  const updateDtr = useDataStore((s) => s.updateDtr)
  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(daysRequired)),
    defaultValues: {
      daysWorked: String(summary?.daysWorked ?? daysRequired),
      leaveWithPayDays: String(summary?.leaveWithPayDays ?? 0),
      absencesWithoutPay: String(summary?.absencesWithoutPay ?? 0),
      tardinessMinutes: String(summary?.tardinessMinutes ?? 0),
      undertimeMinutes: String(summary?.undertimeMinutes ?? 0),
      overtimeHoursRegular: String(summary?.overtimeHoursRegular ?? 0),
      overtimeHoursRestDay: String(summary?.overtimeHoursRestDay ?? 0),
      nightDiffHours: String(summary?.nightDiffHours ?? 0),
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((v) => {
    const record: DtrSummary = {
      employeeId: employee.id,
      periodId: period.id,
      daysRequired,
      daysWorked: Number(v.daysWorked),
      leaveWithPayDays: Number(v.leaveWithPayDays),
      absencesWithoutPay: Number(v.absencesWithoutPay),
      tardinessMinutes: Number(v.tardinessMinutes),
      undertimeMinutes: Number(v.undertimeMinutes),
      overtimeHoursRegular: Number(v.overtimeHoursRegular),
      overtimeHoursRestDay: Number(v.overtimeHoursRestDay),
      nightDiffHours: Number(v.nightDiffHours),
      source: "manual",
    }
    updateDtr(record)
    toast.success(summary ? "DTR summary updated" : "Manual DTR entry created", {
      description: `${fullName(employee)}, ${formatPeriod(period.start, period.end)}`,
    })
    onDone()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const error = errors[f.name]
          const id = `dtr-${f.name}`
          return (
            <Field key={f.name} data-invalid={!!error}>
              <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              <Input
                id={id}
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={!!error}
                aria-describedby={`${id}-unit`}
                {...form.register(f.name)}
              />
              <FieldDescription id={`${id}-unit`}>In {f.unit}</FieldDescription>
              <FieldError errors={[error]} />
            </Field>
          )
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{summary ? "Save summary" : "Create entry"}</Button>
      </DialogFooter>
    </form>
  )
}
