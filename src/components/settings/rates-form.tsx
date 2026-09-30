"use client"

import { useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { get, useFieldArray, useForm, type FieldError, type Path, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"

import type { RatesConfig } from "@/types"
import { formatDate } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError as FieldErrorText, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

import { fromForm, ratesFormSchema, toForm, type RatesFormValues } from "./rates-form-model"

type Form = UseFormReturn<RatesFormValues>
type Unit = "peso" | "percent" | "times" | "none"

export const SEED_NOTE =
  "Seed values for prototype only. Verify against current GSIS, PhilHealth, HDMF, BIR, and DBM issuances before production use."

function fieldId(name: string) {
  return `rates-${name.replace(/\./g, "-")}`
}

function errorAt(form: Form, name: string): FieldError | undefined {
  return get(form.formState.errors, name) as FieldError | undefined
}

function NumField({
  form,
  name,
  label,
  unit = "none",
  step = "any",
  description,
}: {
  form: Form
  name: Path<RatesFormValues>
  label: string
  unit?: Unit
  step?: string
  description?: string
}) {
  const error = errorAt(form, name)
  const id = fieldId(name)
  return (
    <Field data-invalid={!!error} className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-xs">
        {label}
      </FieldLabel>
      <InputGroup>
        {unit === "peso" && (
          <InputGroupAddon>
            <InputGroupText>₱</InputGroupText>
          </InputGroupAddon>
        )}
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          aria-invalid={!!error}
          className="tabular-nums"
          {...form.register(name, { valueAsNumber: true })}
        />
        {(unit === "percent" || unit === "times") && (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{unit === "percent" ? "%" : "x"}</InputGroupText>
          </InputGroupAddon>
        )}
      </InputGroup>
      {description && <FieldDescription className="text-xs">{description}</FieldDescription>}
      <FieldErrorText errors={[error]} className="text-xs" />
    </Field>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

const grid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"

type BracketName = "withholding.semiMonthly" | "withholding.monthly" | "withholding.annual"

function BracketEditor({ form, name, title }: { form: Form; name: BracketName; title: string }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name })
  const arrayError = errorAt(form, name) as (FieldError & { root?: FieldError }) | undefined
  const message = arrayError?.message ?? arrayError?.root?.message
  const cell = "h-7 text-xs tabular-nums"

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[34rem] text-xs" aria-label={`${title} brackets`}>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Over (₱)</th>
              <th className="px-2 py-1.5 text-left font-medium">Not over (₱)</th>
              <th className="px-2 py-1.5 text-left font-medium">Base tax (₱)</th>
              <th className="px-2 py-1.5 text-left font-medium">Rate on excess (%)</th>
              <th className="w-9 px-2 py-1.5">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const row = (key: "over" | "upTo" | "baseTax" | "rate") => `${name}.${i}.${key}` as const
              const err = (key: "over" | "upTo" | "baseTax" | "rate") => errorAt(form, row(key))
              return (
                <tr key={f.id} className="border-t align-top">
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="any"
                      className={cell}
                      aria-label={`${title} bracket ${i + 1}, over`}
                      aria-invalid={!!err("over")}
                      {...form.register(row("over"), { valueAsNumber: true })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="any"
                      placeholder="No limit"
                      className={cell}
                      aria-label={`${title} bracket ${i + 1}, not over. Leave blank for no limit.`}
                      aria-invalid={!!err("upTo")}
                      {...form.register(row("upTo"), {
                        setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v)),
                      })}
                    />
                    {err("upTo") && <p className="mt-1 text-destructive">{err("upTo")?.message}</p>}
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="any"
                      className={cell}
                      aria-label={`${title} bracket ${i + 1}, base tax`}
                      aria-invalid={!!err("baseTax")}
                      {...form.register(row("baseTax"), { valueAsNumber: true })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="any"
                      className={cell}
                      aria-label={`${title} bracket ${i + 1}, rate on excess in percent`}
                      aria-invalid={!!err("rate")}
                      {...form.register(row("rate"), { valueAsNumber: true })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(i)}
                      disabled={fields.length <= 1}
                      aria-label={`Remove ${title} bracket ${i + 1}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const values = form.getValues(name)
          const last = values[values.length - 1]
          append({ over: last?.upTo ?? last?.over ?? 0, upTo: null, baseTax: 0, rate: 0 })
        }}
      >
        <PlusIcon data-icon="inline-start" aria-hidden />
        Add bracket
      </Button>
    </div>
  )
}

function HazardEditor({ form }: { form: Form }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "magnaCarta.hazardRates" })
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[20rem] text-xs" aria-label="Hazard pay bands">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Up to salary grade</th>
              <th className="px-2 py-1.5 text-left font-medium">Rate of monthly basic (%)</th>
              <th className="w-9 px-2 py-1.5">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={f.id} className="border-t">
                <td className="p-1.5">
                  <Input
                    type="number"
                    step="1"
                    className="h-7 text-xs tabular-nums"
                    aria-label={`Hazard band ${i + 1}, up to salary grade`}
                    aria-invalid={!!errorAt(form, `magnaCarta.hazardRates.${i}.maxSalaryGrade`)}
                    {...form.register(`magnaCarta.hazardRates.${i}.maxSalaryGrade`, { valueAsNumber: true })}
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    type="number"
                    step="any"
                    className="h-7 text-xs tabular-nums"
                    aria-label={`Hazard band ${i + 1}, rate in percent`}
                    aria-invalid={!!errorAt(form, `magnaCarta.hazardRates.${i}.rate`)}
                    {...form.register(`magnaCarta.hazardRates.${i}.rate`, { valueAsNumber: true })}
                  />
                </td>
                <td className="p-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(i)}
                    disabled={fields.length <= 1}
                    aria-label={`Remove hazard band ${i + 1}`}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => append({ maxSalaryGrade: 33, rate: 0 })}>
        <PlusIcon data-icon="inline-start" aria-hidden />
        Add band
      </Button>
    </div>
  )
}

function RatesForm({
  source,
  existingDates,
  onDone,
}: {
  source: RatesConfig
  existingDates: string[]
  onDone: (effectivityDate: string) => void
}) {
  const addRatesVersion = useDataStore((s) => s.addRatesVersion)
  const schema = useMemo(() => ratesFormSchema(existingDates), [existingDates])
  const form = useForm<RatesFormValues>({ resolver: zodResolver(schema), defaultValues: toForm(source), mode: "onTouched" })
  const errors = form.formState.errors

  const submit = form.handleSubmit(
    (values) => {
      const rates = fromForm(values)
      addRatesVersion(rates)
      toast.success("Rates version published", {
        description: `${rates.label}, effective ${formatDate(rates.effectivityDate)}.`,
      })
      onDone(rates.effectivityDate)
    },
    () => toast.error("Check the highlighted fields", { description: "Some values are missing or invalid." })
  )

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="flex-1 space-y-6 overflow-y-auto p-4 pb-6">
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{SEED_NOTE}</p>

        <FormSection title="Version">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={!!errors.label} className="gap-1.5">
              <FieldLabel htmlFor="rates-label" className="text-xs">
                Label
              </FieldLabel>
              <Input id="rates-label" aria-invalid={!!errors.label} {...form.register("label")} />
              <FieldErrorText errors={[errors.label]} className="text-xs" />
            </Field>
            <Field data-invalid={!!errors.effectivityDate} className="gap-1.5">
              <FieldLabel htmlFor="rates-effectivity" className="text-xs">
                Effectivity date
              </FieldLabel>
              <Input id="rates-effectivity" type="date" aria-invalid={!!errors.effectivityDate} {...form.register("effectivityDate")} />
              <FieldDescription className="text-xs">Must differ from every existing version.</FieldDescription>
              <FieldErrorText errors={[errors.effectivityDate]} className="text-xs" />
            </Field>
            <Field data-invalid={!!errors.legalBasis} className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="rates-basis" className="text-xs">
                Legal basis
              </FieldLabel>
              <Textarea id="rates-basis" rows={2} aria-invalid={!!errors.legalBasis} {...form.register("legalBasis")} />
              <FieldErrorText errors={[errors.legalBasis]} className="text-xs" />
            </Field>
          </div>
        </FormSection>

        <Separator />
        <FormSection title="GSIS">
          <div className={grid}>
            <NumField form={form} name="gsis.personalRate" label="Personal share" unit="percent" />
            <NumField form={form} name="gsis.governmentRate" label="Government share" unit="percent" />
            <NumField form={form} name="gsis.eccMonthly" label="ECC per month" unit="peso" />
          </div>
        </FormSection>

        <FormSection title="PhilHealth">
          <div className={grid}>
            <NumField form={form} name="philhealth.premiumRate" label="Premium rate" unit="percent" />
            <NumField form={form} name="philhealth.employeeShare" label="Employee share of premium" unit="percent" />
            <NumField form={form} name="philhealth.floor" label="Salary floor" unit="peso" />
            <NumField form={form} name="philhealth.ceiling" label="Salary ceiling" unit="peso" />
          </div>
        </FormSection>

        <FormSection title="Pag-IBIG">
          <div className={grid}>
            <NumField form={form} name="pagibig.employeeRateLow" label="Employee rate (low income)" unit="percent" />
            <NumField form={form} name="pagibig.employeeRate" label="Employee rate" unit="percent" />
            <NumField form={form} name="pagibig.employerRate" label="Employer rate" unit="percent" />
            <NumField form={form} name="pagibig.lowIncomeThreshold" label="Low-income threshold" unit="peso" />
            <NumField form={form} name="pagibig.maxFundSalary" label="Max fund salary" unit="peso" />
          </div>
        </FormSection>

        <Separator />
        <FormSection title="Withholding tax tables">
          <Tabs defaultValue="semiMonthly">
            <TabsList>
              <TabsTrigger value="semiMonthly">Semi-monthly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
            <TabsContent value="semiMonthly" keepMounted>
              <BracketEditor form={form} name="withholding.semiMonthly" title="Semi-monthly" />
            </TabsContent>
            <TabsContent value="monthly" keepMounted>
              <BracketEditor form={form} name="withholding.monthly" title="Monthly" />
            </TabsContent>
            <TabsContent value="annual" keepMounted>
              <BracketEditor form={form} name="withholding.annual" title="Annual" />
            </TabsContent>
          </Tabs>
        </FormSection>

        <Separator />
        <FormSection title="Other rates">
          <div className={grid}>
            <NumField form={form} name="peraMonthly" label="PERA per month" unit="peso" />
            <NumField form={form} name="workingDaysPerMonth" label="Working days per month" step="1" />
            <NumField form={form} name="hoursPerDay" label="Hours per day" step="1" />
            <NumField form={form} name="overtime.regularDayMultiplier" label="OT multiplier, regular day" unit="times" />
            <NumField form={form} name="overtime.restDayMultiplier" label="OT multiplier, rest day" unit="times" />
            <NumField form={form} name="nightDiff.rate" label="Night differential rate" unit="percent" />
            <NumField form={form} name="nightDiff.maxSalaryGrade" label="Night differential up to SG" step="1" />
            <NumField form={form} name="minimumNetPayMonthly" label="Minimum monthly net pay" unit="peso" />
            <NumField form={form} name="joCos.withholdingRate" label="JO/COS withholding rate" unit="percent" />
          </div>
        </FormSection>

        <Separator />
        <FormSection title="Magna Carta">
          <div className={grid}>
            <NumField form={form} name="magnaCarta.subsistencePerDay" label="Subsistence per day" unit="peso" />
            <NumField form={form} name="magnaCarta.subsistenceMaxDays" label="Subsistence max days" step="1" />
            <NumField form={form} name="magnaCarta.laundryMonthly" label="Laundry per month" unit="peso" />
            <NumField form={form} name="magnaCarta.longevityRate" label="Longevity rate per block" unit="percent" />
            <NumField form={form} name="magnaCarta.longevityYearsPerBlock" label="Years per longevity block" step="1" />
          </div>
          <HazardEditor form={form} />
        </FormSection>

        <Separator />
        <FormSection title="Bonuses">
          <div className={grid}>
            <NumField form={form} name="bonuses.cashGift" label="Cash gift" unit="peso" />
            <NumField form={form} name="bonuses.pei" label="PEI" unit="peso" />
            <NumField form={form} name="bonuses.uniformAllowance" label="Uniform allowance" unit="peso" />
            <NumField form={form} name="bonuses.minimumMonthsForBonus" label="Minimum months of service" step="1" />
            <NumField form={form} name="bonuses.exemptionCeiling" label="13th month and other benefits exemption" unit="peso" />
          </div>
        </FormSection>

        <Separator />
        <FormSection title="Leave monetization">
          <div className={grid}>
            <NumField form={form} name="leaveMonetization.retainedDays" label="VL days retained" step="1" />
            <NumField form={form} name="leaveMonetization.maxDaysPerApplication" label="Maximum days per application" step="1" />
          </div>
        </FormSection>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={() => onDone("")}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Publish version
        </Button>
      </SheetFooter>
    </form>
  )
}

export function RatesVersionSheet({
  open,
  onOpenChange,
  source,
  existingDates,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: RatesConfig
  existingDates: string[]
  onCreated: (effectivityDate: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b">
          <SheetTitle>Create new rates version</SheetTitle>
          <SheetDescription>
            Prefilled from {source.label}. Payroll computed on or after the effectivity date uses the new version.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <RatesForm
            source={source}
            existingDates={existingDates}
            onDone={(date) => {
              onOpenChange(false)
              if (date) onCreated(date)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
