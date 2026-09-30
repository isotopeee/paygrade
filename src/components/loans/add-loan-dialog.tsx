"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { LoanType } from "@/types"
import { LOAN_TYPE_AGENCY, LOAN_TYPE_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatMonthLong, registerName } from "@/lib/format"
import { loanEndDate, loanTerms } from "@/lib/loans"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const LOAN_TYPES = Object.keys(LOAN_TYPE_LABELS) as [LoanType, ...LoanType[]]

const schema = z.object({
  employeeId: z.string().min(1, "Select an employee"),
  type: z.enum(LOAN_TYPES, { error: "Select a loan or deduction type" }),
  referenceNo: z
    .string()
    .trim()
    .min(3, "Enter the reference or account number")
    .max(40, "Use at most 40 characters"),
  principal: z
    .number({ error: "Enter the principal amount in pesos" })
    .positive("Principal must be more than zero")
    .max(5_000_000, "Principal cannot exceed PHP 5,000,000"),
  termMonths: z
    .number({ error: "Enter the term in months" })
    .int("Use whole months")
    .min(1, "Term must be at least 1 month")
    .max(120, "Term cannot exceed 120 months"),
  interestRate: z
    .number({ error: "Enter the add-on interest rate, 0 if none" })
    .min(0, "Rate cannot be negative")
    .max(36, "Rate cannot exceed 36% per annum"),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, "Select the first deduction month"),
})

type FormValues = z.infer<typeof schema>

const DEFAULTS: FormValues = {
  employeeId: "",
  type: "gsis_mpl",
  referenceNo: "",
  principal: Number.NaN,
  termMonths: 24,
  interestRate: 10,
  startMonth: "2026-10",
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function AddLoanDialog() {
  const employees = useDataStore((s) => s.employees)
  const addLoan = useDataStore((s) => s.addLoan)
  const [open, setOpen] = React.useState(false)

  const activeEmployees = React.useMemo(
    () =>
      employees
        .filter((e) => e.status === "active" || e.status === "on_leave")
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [employees]
  )

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS, mode: "onTouched" })
  const { register, handleSubmit, formState, control, reset, setError } = form
  const errors = formState.errors

  const [principal, termMonths, interestRate, startMonth, loanType] = useWatch({
    control,
    name: ["principal", "termMonths", "interestRate", "startMonth", "type"],
  })

  const principalC = pesos(safeNumber(principal))
  const term = Math.floor(safeNumber(termMonths))
  const validTerm = term >= 1 && term <= 120
  const terms = loanTerms(principalC, validTerm ? term : 0, safeNumber(interestRate))
  const validStart = /^\d{4}-\d{2}$/.test(startMonth ?? "")
  const endDate = validStart && validTerm ? loanEndDate(`${startMonth}-01`, term) : undefined

  const onSubmit = (values: FormValues) => {
    const employee = employees.find((e) => e.id === values.employeeId)
    if (!employee) {
      setError("employeeId", { message: "Select an employee" })
      return
    }
    if (values.type.startsWith("gsis_") && !employee.gsisBpNo) {
      setError("type", { message: "This employee has no GSIS BP number. GSIS loans apply to GSIS members only." })
      return
    }
    const p = pesos(values.principal)
    const t = loanTerms(p, values.termMonths, values.interestRate)
    const startPeriod = `${values.startMonth}-01`
    addLoan({
      employeeId: values.employeeId,
      type: values.type,
      referenceNo: values.referenceNo.trim().toUpperCase(),
      principal: p,
      monthlyAmortization: t.monthlyAmortization,
      totalPayable: t.totalPayable,
      startPeriod,
      endPeriod: loanEndDate(startPeriod, values.termMonths),
      termMonths: values.termMonths,
      paidToDate: 0,
      status: "active",
    })
    toast.success("Loan added to the deduction ledger", {
      description: `${LOAN_TYPE_LABELS[values.type]} for ${registerName(employee)}, ${formatCurrency(t.monthlyAmortization)} monthly starting ${formatMonthLong(startPeriod)}.`,
    })
    setOpen(false)
    reset(DEFAULTS)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset(DEFAULTS)
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" aria-hidden />
        Add loan or deduction
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add loan or deduction</DialogTitle>
          <DialogDescription>
            Record an authorized payroll deduction. The monthly amortization is deducted in full from each monthly payroll.
          </DialogDescription>
        </DialogHeader>

        <form id="add-loan-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.employeeId}>
              <FieldLabel htmlFor="loan-employee">Employee</FieldLabel>
              <NativeSelect id="loan-employee" className="w-full" aria-invalid={!!errors.employeeId} {...register("employeeId")}>
                <NativeSelectOption value="">Select an employee</NativeSelectOption>
                {activeEmployees.map((e) => (
                  <NativeSelectOption key={e.id} value={e.id}>
                    {registerName(e)} ({e.employeeNo})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.employeeId]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.type}>
                <FieldLabel htmlFor="loan-type">Type</FieldLabel>
                <NativeSelect id="loan-type" className="w-full" aria-invalid={!!errors.type} {...register("type")}>
                  {LOAN_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {LOAN_TYPE_LABELS[t]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.type]} />
              </Field>
              <Field data-invalid={!!errors.referenceNo}>
                <FieldLabel htmlFor="loan-ref">Reference No.</FieldLabel>
                <Input
                  id="loan-ref"
                  className="font-mono"
                  placeholder="MPL-2026-004512"
                  autoComplete="off"
                  aria-invalid={!!errors.referenceNo}
                  {...register("referenceNo")}
                />
                <FieldError errors={[errors.referenceNo]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.principal}>
                <FieldLabel htmlFor="loan-principal">Principal (PHP)</FieldLabel>
                <Input
                  id="loan-principal"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="50000.00"
                  className="tabular-nums"
                  aria-invalid={!!errors.principal}
                  {...register("principal", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.principal]} />
              </Field>
              <Field data-invalid={!!errors.termMonths}>
                <FieldLabel htmlFor="loan-term">Term (months)</FieldLabel>
                <Input
                  id="loan-term"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  step={1}
                  className="tabular-nums"
                  aria-invalid={!!errors.termMonths}
                  {...register("termMonths", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.termMonths]} />
              </Field>
              <Field data-invalid={!!errors.interestRate}>
                <FieldLabel htmlFor="loan-rate">Add-on interest (% p.a.)</FieldLabel>
                <Input
                  id="loan-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={36}
                  step="0.01"
                  className="tabular-nums"
                  aria-invalid={!!errors.interestRate}
                  {...register("interestRate", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.interestRate]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.startMonth} className="sm:max-w-[calc(33.333%-0.667rem)]">
              <FieldLabel htmlFor="loan-start">First deduction month</FieldLabel>
              <Input id="loan-start" type="month" aria-invalid={!!errors.startMonth} {...register("startMonth")} />
              <FieldError errors={[errors.startMonth]} />
            </Field>

            <div className="rounded-lg border bg-muted/40 p-3" aria-live="polite">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Computed terms</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Interest</dt>
                  <dd className="tabular-nums">{formatCurrency(terms.interest)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total payable</dt>
                  <dd className="tabular-nums">{formatCurrency(terms.totalPayable)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Monthly amortization</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(terms.monthlyAmortization)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last deduction</dt>
                  <dd className="tabular-nums">{endDate ? formatDate(endDate) : "Not set"}</dd>
                </div>
              </dl>
              <FieldDescription className="mt-2 text-xs">
                Deducted in full from each monthly payroll. Remitted to {loanType ? LOAN_TYPE_AGENCY[loanType] : "the creditor"}.
              </FieldDescription>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-loan-form" disabled={formState.isSubmitting}>
            Save loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
