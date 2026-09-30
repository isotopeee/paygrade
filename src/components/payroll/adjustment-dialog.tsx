"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { PayrollLine, PayrollRun } from "@/types"
import { formatCurrency } from "@/lib/format"
import { pesos } from "@/lib/payroll/money"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

const EARNING_PRESETS = [
  "Salary differential",
  "Step increment differential",
  "Unpaid service",
  "Refund of overdeduction",
  "Overtime not captured in DTR",
]
const DEDUCTION_PRESETS = [
  "Recovery of overpayment",
  "Unauthorized absence (LWOP) not captured",
  "Refund of cash advance",
  "Disallowance per COA Notice",
]

const schema = z.object({
  employeeId: z.string().min(1, "Select an employee"),
  kind: z.enum(["earning", "deduction"]),
  label: z.string().trim().min(3, "Enter a description of at least 3 characters").max(80),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount in pesos, up to 2 decimal places")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero")
    .refine((v) => Number(v) <= 500_000, "Amount is unusually large. Split it or verify the figure."),
  reason: z
    .string()
    .trim()
    .min(15, "A reason of at least 15 characters is required for the audit trail")
    .max(500),
})

type FormValues = z.infer<typeof schema>

export function AdjustmentDialog({
  run,
  open,
  onOpenChange,
  employeeId,
}: {
  run: PayrollRun
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId?: string
}) {
  const addAdjustment = useDataStore((s) => s.addAdjustment)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: employeeId ?? "", kind: "earning", label: "", amount: "", reason: "" },
  })

  useEffect(() => {
    if (open) form.reset({ employeeId: employeeId ?? "", kind: "earning", label: "", amount: "", reason: "" })
  }, [open, employeeId, form])

  const kind = useWatch({ control: form.control, name: "kind" })
  const selected = useWatch({ control: form.control, name: "employeeId" })
  const amountText = useWatch({ control: form.control, name: "amount" })
  const line: PayrollLine | undefined = run.lines.find((l) => l.employeeId === selected)
  const amount = Number(amountText) || 0
  const presets = kind === "earning" ? EARNING_PRESETS : DEDUCTION_PRESETS

  const onSubmit = (values: FormValues) => {
    const before = run.lines.find((l) => l.employeeId === values.employeeId)?.net ?? 0
    addAdjustment(run.id, {
      employeeId: values.employeeId,
      kind: values.kind,
      label: values.label,
      amount: pesos(values.amount),
      reason: values.reason,
    })
    const after =
      useDataStore
        .getState()
        .runs.find((r) => r.id === run.id)
        ?.lines.find((l) => l.employeeId === values.employeeId)?.net ?? before
    toast.success("Adjustment added and payroll recomputed", {
      description: `Net pay ${formatCurrency(before)} to ${formatCurrency(after)}. Logged to the audit trail.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual adjustment</DialogTitle>
          <DialogDescription>
            Adds an earning or deduction to this run only. The line is recomputed, taxes included, and the change is
            recorded in the audit trail with your reason.
          </DialogDescription>
        </DialogHeader>
        <form id="adjustment-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              control={form.control}
              name="employeeId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="adj-employee">Employee</FieldLabel>
                  <NativeSelect
                    id="adj-employee"
                    {...field}
                    disabled={!!employeeId}
                    aria-invalid={fieldState.invalid || undefined}
                  >
                    <NativeSelectOption value="">Select an employee</NativeSelectOption>
                    {run.lines.map((l) => (
                      <NativeSelectOption key={l.employeeId} value={l.employeeId}>
                        {l.employeeName} ({l.employeeNo})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {line && (
                    <FieldDescription>
                      Current net pay {formatCurrency(line.net)}, gross {formatCurrency(line.gross)}
                    </FieldDescription>
                  )}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                    className="grid-cols-2"
                    aria-label="Adjustment type"
                  >
                    {(["earning", "deduction"] as const).map((k) => (
                      <label
                        key={k}
                        htmlFor={`adj-kind-${k}`}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm has-data-checked:border-foreground"
                      >
                        <RadioGroupItem
                          value={k}
                          id={`adj-kind-${k}`}
                          aria-label={k === "earning" ? "Earning" : "Deduction"}
                        />
                        {k === "earning" ? "Earning (adds to gross)" : "Deduction"}
                      </label>
                    ))}
                  </RadioGroup>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="label"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="adj-label">Description</FieldLabel>
                  <Input
                    id="adj-label"
                    {...field}
                    list="adj-presets"
                    placeholder={presets[0]}
                    aria-invalid={fieldState.invalid || undefined}
                  />
                  <datalist id="adj-presets">
                    {presets.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <div className="flex flex-wrap gap-1">
                    {presets.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => form.setValue("label", p, { shouldValidate: true })}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="adj-amount">Amount</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>₱</InputGroupAddon>
                    <InputGroupInput
                      id="adj-amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="tabular-nums"
                      aria-invalid={fieldState.invalid || undefined}
                      {...field}
                    />
                  </InputGroup>
                  {line && amount > 0 && (
                    <FieldDescription>
                      Gross becomes about {formatCurrency(kind === "earning" ? line.gross + pesos(amount) : line.gross)}
                      {kind === "earning" ? " before tax recomputation" : ""}.
                    </FieldDescription>
                  )}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="reason"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="adj-reason">Reason</FieldLabel>
                  <Textarea
                    id="adj-reason"
                    rows={3}
                    placeholder="Cite the supporting document, for example: Notice of Salary Adjustment dated Sep 2, 2026."
                    aria-invalid={fieldState.invalid || undefined}
                    {...field}
                  />
                  <FieldDescription>Required. Stored in the audit log with your name and role.</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="adjustment-form">
            Add adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
