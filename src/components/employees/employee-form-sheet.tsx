"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import type { Employee } from "@/types"
import { EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, groupOf } from "@/lib/constants"
import {
  changedFields,
  emptyEmployeeForm,
  employeeFormSchema,
  employeeToForm,
  formToEmployeeFields,
  idFormatters,
  nextEmployeeNo,
  type EmployeeFormValues,
  type FormattedIdField,
} from "@/lib/employees"
import { formatCurrency, fullName } from "@/lib/format"
import { salaryFor } from "@/lib/payroll/compute"
import { scheduleForDate } from "@/lib/payroll/engine"
import { pesos } from "@/lib/payroll/money"
import { ratesForDate } from "@/lib/payroll/rates"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"

type StringField = {
  [K in keyof EmployeeFormValues]: EmployeeFormValues[K] extends string ? K : never
}[keyof EmployeeFormValues]

const FIELD_ID = (name: string) => `employee-${name}`

function TextField({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  mono = false,
  className,
}: {
  control: Control<EmployeeFormValues>
  name: StringField
  label: string
  description?: string
  placeholder?: string
  type?: "text" | "date" | "email" | "tel"
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email"
  autoComplete?: string
  mono?: boolean
  className?: string
}) {
  const formatter = name in idFormatters ? idFormatters[name as FormattedIdField] : undefined
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={FIELD_ID(name)}>{label}</FieldLabel>
          <Input
            id={FIELD_ID(name)}
            name={field.name}
            ref={field.ref}
            value={field.value}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(formatter ? formatter(e.target.value) : e.target.value)}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid || undefined}
            className={mono ? "font-mono" : undefined}
          />
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function SelectField({
  control,
  name,
  label,
  options,
  description,
  onValueChange,
  className,
}: {
  control: Control<EmployeeFormValues>
  name: StringField
  label: string
  options: { value: string; label: string }[]
  description?: string
  onValueChange?: (value: string) => void
  className?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={FIELD_ID(name)}>{label}</FieldLabel>
          <NativeSelect
            id={FIELD_ID(name)}
            name={field.name}
            ref={field.ref}
            value={field.value}
            onBlur={field.onBlur}
            onChange={(e) => {
              field.onChange(e.target.value)
              onValueChange?.(e.target.value)
            }}
            aria-invalid={fieldState.invalid || undefined}
            className="w-full"
          >
            {options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
]
const CIVIL_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
]
const TYPE_OPTIONS = Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const STATUS_OPTIONS = Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const GRADE_OPTIONS = [
  { value: "", label: "Select" },
  ...Array.from({ length: 33 }, (_, i) => ({ value: String(i + 1), label: `SG ${i + 1}` })),
]
const STEP_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Step ${i + 1}` }))

export function EmployeeFormSheet({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Employee to edit. Omit to add a new employee. */
  employee?: Employee
}) {
  const router = useRouter()
  const departments = useDataStore((s) => s.departments)
  const employees = useDataStore((s) => s.employees)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const addEmployee = useDataStore((s) => s.addEmployee)
  const updateEmployee = useDataStore((s) => s.updateEmployee)

  const editing = !!employee

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee ? employeeToForm(employee) : emptyEmployeeForm(),
    mode: "onTouched",
  })
  const { control, handleSubmit, reset, setValue, formState } = form

  useEffect(() => {
    if (open) reset(employee ? employeeToForm(employee) : emptyEmployeeForm(departments[0]?.id ?? ""))
    // Reset only when the sheet opens or the target employee changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id])

  const employmentType = useWatch({ control, name: "employmentType" })
  const status = useWatch({ control, name: "status" })
  const salaryGrade = useWatch({ control, name: "salaryGrade" })
  const step = useWatch({ control, name: "step" })
  const contractRate = useWatch({ control, name: "contractRate" })
  const dateHired = useWatch({ control, name: "dateHired" })

  const plantilla = groupOf(employmentType) === "plantilla"
  const isJo = employmentType === "job_order"

  const departmentOptions = useMemo(
    () => [{ value: "", label: "Select a department" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments]
  )

  const ratePreview = useMemo(() => {
    const asOf = dateHired && dateHired > DEMO_TODAY ? dateHired : DEMO_TODAY
    if (plantilla) {
      const sg = Number(salaryGrade)
      const st = Number(step)
      if (!sg || !st || sg > 33 || st > 8) return null
      const schedule = scheduleForDate(salarySchedules, asOf)
      return `Monthly basic ${formatCurrency(salaryFor(schedule, sg, st))} under ${schedule.name}.`
    }
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(contractRate) || Number(contractRate) <= 0) return null
    const rates = ratesForDate(ratesVersions, asOf)
    const amount = pesos(contractRate)
    return isJo
      ? `Monthly equivalent ${formatCurrency(amount * rates.workingDaysPerMonth)} at ${rates.workingDaysPerMonth} working days per month.`
      : `Monthly contract rate ${formatCurrency(amount)}.`
  }, [plantilla, isJo, salaryGrade, step, contractRate, dateHired, salarySchedules, ratesVersions])

  const onTypeChange = (value: string) => {
    if (value === "job_order" || value === "contract_of_service") {
      setValue("gsisBpNo", "", { shouldValidate: formState.isSubmitted })
      setValue("itemNo", "")
    }
  }

  const onSubmit = handleSubmit((values) => {
    const fields = formToEmployeeFields(values)
    if (employee) {
      const patch = changedFields(employee, fields)
      if (Object.keys(patch).length === 0) {
        toast.info("No changes to save")
        onOpenChange(false)
        return
      }
      updateEmployee(employee.id, patch)
      toast.success("Employee record updated", {
        description: `${fullName(fields)}. ${Object.keys(patch).length} field${Object.keys(patch).length === 1 ? "" : "s"} changed.`,
      })
      onOpenChange(false)
      return
    }
    const employeeNo = nextEmployeeNo(employees, values.employmentType, values.dateHired)
    const id = addEmployee({ ...fields, employeeNo, status: "active", allowances: [], documents: [] })
    toast.success("Employee added", { description: `${fullName(fields)}, employee no. ${employeeNo}.` })
    onOpenChange(false)
    router.push(`/employees/${id}`)
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{employee ? `Edit ${fullName(employee)}` : "Add employee"}</SheetTitle>
          <SheetDescription>
            {employee
              ? `Employee no. ${employee.employeeNo}. Changes are recorded in the audit log.`
              : "The employee number is assigned on save from the hire year and employment type."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <FieldGroup className="gap-7">
              <FieldSet>
                <FieldLegend>Personal</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField control={control} name="firstName" label="First name" autoComplete="off" />
                  <TextField control={control} name="middleName" label="Middle name" autoComplete="off" />
                  <TextField control={control} name="lastName" label="Last name" autoComplete="off" />
                  <TextField control={control} name="suffix" label="Suffix" placeholder="Jr., III" autoComplete="off" />
                  <SelectField control={control} name="sex" label="Sex" options={SEX_OPTIONS} />
                  <SelectField control={control} name="civilStatus" label="Civil status" options={CIVIL_OPTIONS} />
                  <TextField control={control} name="birthDate" label="Birth date" type="date" />
                  <TextField
                    control={control}
                    name="mobile"
                    label="Mobile number"
                    type="tel"
                    inputMode="numeric"
                    placeholder="0917 123 4567"
                  />
                  <TextField
                    control={control}
                    name="email"
                    label="Email"
                    type="email"
                    placeholder="juan.delacruz@mmwgh.doh.gov.ph"
                  />
                  <TextField
                    control={control}
                    name="address"
                    label="Address"
                    placeholder="Purok 3, Brgy. Alas-asin, Mariveles, Bataan"
                    className="sm:col-span-2"
                  />
                </div>
              </FieldSet>

              <Separator />

              <FieldSet>
                <FieldLegend>Government IDs</FieldLegend>
                <FieldDescription>Separators are inserted as you type.</FieldDescription>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField control={control} name="tin" label="TIN" inputMode="numeric" placeholder="123-456-789-000" mono />
                  <TextField
                    control={control}
                    name="gsisBpNo"
                    label="GSIS BP No."
                    inputMode="numeric"
                    placeholder={plantilla ? "11 digits" : "Not applicable"}
                    description={plantilla ? "Required for plantilla personnel." : "JO and COS workers are not GSIS members."}
                    mono
                  />
                  <TextField
                    control={control}
                    name="philhealthNo"
                    label="PhilHealth No."
                    inputMode="numeric"
                    placeholder="12-345678901-2"
                    mono
                  />
                  <TextField
                    control={control}
                    name="pagibigMid"
                    label="Pag-IBIG MID"
                    inputMode="numeric"
                    placeholder="1210-1234-5678"
                    mono
                  />
                  <TextField
                    control={control}
                    name="bankAccountNo"
                    label="Landbank account no."
                    inputMode="numeric"
                    placeholder="1234-5678-90"
                    description="Payroll credit account."
                    mono
                  />
                </div>
              </FieldSet>

              <Separator />

              <FieldSet>
                <FieldLegend>Employment</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    control={control}
                    name="employmentType"
                    label="Employment type"
                    options={TYPE_OPTIONS}
                    onValueChange={onTypeChange}
                  />
                  <SelectField control={control} name="departmentId" label="Department" options={departmentOptions} />
                  <TextField
                    control={control}
                    name="positionTitle"
                    label="Position title"
                    placeholder={plantilla ? "Nurse II" : "Utility Worker"}
                  />
                  <TextField control={control} name="dateHired" label="Date hired" type="date" />
                  {plantilla && (
                    <TextField
                      control={control}
                      name="itemNo"
                      label="Plantilla item no."
                      placeholder="MMWGH-NUR2-000123-2026"
                      description={employmentType === "permanent" ? "Required for permanent appointments." : "Optional for casual and contractual."}
                      mono
                    />
                  )}
                  {!plantilla && (
                    <TextField
                      control={control}
                      name="contractEnd"
                      label="Contract end"
                      type="date"
                    />
                  )}
                  {editing && <SelectField control={control} name="status" label="Status" options={STATUS_OPTIONS} />}
                  {editing && status === "separated" && (
                    <TextField control={control} name="separationDate" label="Separation date" type="date" />
                  )}
                </div>
              </FieldSet>

              <Separator />

              <FieldSet>
                <FieldLegend>Compensation</FieldLegend>
                {plantilla ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField control={control} name="salaryGrade" label="Salary grade" options={GRADE_OPTIONS} />
                    <SelectField control={control} name="step" label="Step" options={STEP_OPTIONS} />
                    <TextField
                      control={control}
                      name="lastStepIncrement"
                      label="Last step increment"
                      type="date"
                      description="Leave blank if still at the hiring step."
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      control={control}
                      name="contractRate"
                      label={isJo ? "Daily rate (PHP)" : "Monthly rate (PHP)"}
                      inputMode="decimal"
                      placeholder={isJo ? "610.00" : "36000.00"}
                      description={isJo ? "Paid for days actually worked." : "Paid monthly under the contract."}
                    />
                    <Controller
                      control={control}
                      name="swornDeclaration"
                      render={({ field }) => (
                        <Field orientation="horizontal" className="self-start rounded-lg border p-3">
                          <div className="flex flex-1 flex-col gap-0.5">
                            <FieldLabel htmlFor={FIELD_ID("swornDeclaration")}>Sworn declaration on file</FieldLabel>
                            <FieldDescription className="text-xs">
                              Annual income will not exceed the tax exemption threshold. Without it, a flat rate is withheld.
                            </FieldDescription>
                          </div>
                          <Switch
                            id={FIELD_ID("swornDeclaration")}
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked)}
                          />
                        </Field>
                      )}
                    />
                  </div>
                )}
                {ratePreview && <p className="text-sm text-muted-foreground tabular-nums">{ratePreview}</p>}
              </FieldSet>
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Add employee"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
