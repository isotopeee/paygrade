"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Agency, Remittance, RemittanceFiling } from "@/types"
import { AGENCY_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatMonthLong } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
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
import { Input } from "@/components/ui/input"

export type FilingMode = "filed" | "paid"

const REF_PREFIX: Record<Agency, string> = { gsis: "GS", philhealth: "PH", pagibig: "HD", bir: "BIR" }

const schema = z.object({
  referenceNo: z
    .string()
    .trim()
    .min(4, "Enter the reference number")
    .max(40, "Use at most 40 characters"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date")
    .refine((d) => d <= DEMO_TODAY, "Date cannot be later than today"),
})

type FormValues = z.infer<typeof schema>

/**
 * Mark a monthly remittance as filed (reference and filing date) or paid
 * (OR or reference number and payment date). Paying an unfiled remittance
 * records the filing date as the payment date.
 */
export function FilingDialog({
  remittance,
  mode,
  onClose,
}: {
  remittance: Remittance
  mode: FilingMode
  onClose: () => void
}) {
  const setRemittanceFiling = useDataStore((s) => s.setRemittanceFiling)
  const [open, setOpen] = React.useState(true)
  const agency = AGENCY_LABELS[remittance.agency]
  const label = `${agency}, ${formatMonthLong(remittance.month)}`
  const total = remittance.employeeShare + remittance.governmentShare

  const { register, handleSubmit, formState, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { referenceNo: remittance.referenceNo ?? "", date: DEMO_TODAY },
  })
  const errors = formState.errors

  const onSubmit = (values: FormValues) => {
    if (mode === "paid" && remittance.filedAt && values.date < remittance.filedAt) {
      setError("date", { message: `Payment date cannot be earlier than the filing date, ${formatDate(remittance.filedAt)}` })
      return
    }
    const referenceNo = values.referenceNo.trim().toUpperCase()
    const filing: RemittanceFiling =
      mode === "filed"
        ? { status: "filed", referenceNo, filedAt: values.date }
        : { status: "paid", referenceNo, filedAt: remittance.filedAt ?? values.date, paidAt: values.date }
    setRemittanceFiling(remittance.id, label, filing)
    toast.success(mode === "filed" ? "Remittance marked as filed" : "Remittance marked as paid", {
      description: `${label}, ${formatCurrency(total)}. Reference ${referenceNo}.`,
    })
    setOpen(false)
  }

  const formId = `filing-${remittance.id}`

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "filed" ? "Mark as filed" : "Mark as paid"}</DialogTitle>
          <DialogDescription>
            {label}. Amount due {formatCurrency(total)}, due {formatDate(remittance.dueDate)}.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.referenceNo}>
              <FieldLabel htmlFor={`${formId}-ref`}>
                {mode === "filed" ? "Filing reference No." : "OR or payment reference No."}
              </FieldLabel>
              <Input
                id={`${formId}-ref`}
                className="font-mono"
                autoComplete="off"
                placeholder={`${REF_PREFIX[remittance.agency]}-2026-0000000`}
                aria-invalid={!!errors.referenceNo}
                {...register("referenceNo")}
              />
              <FieldError errors={[errors.referenceNo]} />
            </Field>
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor={`${formId}-date`}>{mode === "filed" ? "Filing date" : "Payment date"}</FieldLabel>
              <Input id={`${formId}-date`} type="date" max={DEMO_TODAY} aria-invalid={!!errors.date} {...register("date")} />
              {mode === "paid" && remittance.status === "pending" && (
                <FieldDescription>This remittance has not been filed. The filing date will be set to the payment date.</FieldDescription>
              )}
              <FieldError errors={[errors.date]} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            {mode === "filed" ? "Mark as filed" : "Mark as paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
