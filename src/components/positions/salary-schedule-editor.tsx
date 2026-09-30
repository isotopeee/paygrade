"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AlertCircleIcon, PercentIcon, RotateCcwIcon } from "lucide-react"

import type { SalarySchedule } from "@/types"
import { formatDate } from "@/lib/format"
import { pesos, toPesos } from "@/lib/payroll/money"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { GRADES, STEPS } from "./salary-matrix"

const PESO_PATTERN = /^\d+(\.\d{1,2})?$/

function toCell(centavos: number): string {
  const p = toPesos(centavos)
  return Number.isInteger(p) ? String(p) : p.toFixed(2)
}

function cellKey(g: number, s: number) {
  return `${g}-${s}`
}

/** Validate the grid: positive peso amounts, each step at least the previous step. */
export function validateGrid(grid: string[][]): Map<string, string> {
  const errors = new Map<string, string>()
  GRADES.forEach((g) => {
    let prev: number | null = null
    STEPS.forEach((s) => {
      const raw = (grid[g - 1]?.[s - 1] ?? "").trim().replace(/,/g, "")
      if (!PESO_PATTERN.test(raw) || Number(raw) <= 0) {
        errors.set(cellKey(g, s), "Enter a positive peso amount")
        prev = null
        return
      }
      const value = Number(raw)
      if (prev !== null && value < prev) errors.set(cellKey(g, s), `Must be at least Step ${s - 1}`)
      prev = value
    })
  })
  return errors
}

export function SalaryScheduleEditor({
  base,
  latestDate,
  onCancel,
  onSaved,
}: {
  /** Version the new tranche starts from (the latest version). */
  base: SalarySchedule
  latestDate: string
  onCancel: () => void
  onSaved: (id: string) => void
}) {
  const addSalarySchedule = useDataStore((s) => s.addSalarySchedule)
  const baseGrid = useMemo(() => base.matrix.map((row) => row.map(toCell)), [base])
  const [grid, setGrid] = useState<string[][]>(baseGrid)
  const [atb, setAtb] = useState("")
  const [atbError, setAtbError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(3, "Enter a version name").max(80),
        legalBasis: z.string().trim().min(3, "Enter the legal basis, for example the EO and NBC number").max(120),
        effectivityDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Select an effectivity date")
          .refine((v) => v > latestDate, `Must be after ${formatDate(latestDate)}, the latest version's effectivity`),
      }),
    [latestDate]
  )
  type Meta = z.infer<typeof schema>
  const form = useForm<Meta>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", legalBasis: "", effectivityDate: "" },
  })
  const { errors } = form.formState

  const gridErrors = useMemo(() => validateGrid(grid), [grid])

  const setCell = (g: number, s: number, value: string) => {
    setGrid((current) => current.map((row, gi) => (gi === g - 1 ? row.map((c, si) => (si === s - 1 ? value : c)) : row)))
  }

  const applyAtb = () => {
    const pct = Number(atb)
    if (atb.trim() === "" || !Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setAtbError("Enter a percentage greater than 0 and up to 100")
      return
    }
    setAtbError(null)
    setGrid(base.matrix.map((row) => row.map((c) => String(Math.round(toPesos(c) * (1 + pct / 100))))))
    toast.success(`Applied ${pct}% across-the-board increase`, {
      description: `Computed from ${base.name}, rounded to the nearest peso.`,
    })
  }

  const onSubmit = form.handleSubmit((values) => {
    if (gridErrors.size > 0) {
      toast.error("Fix the highlighted cells before publishing", {
        description: `${gridErrors.size} cell${gridErrors.size > 1 ? "s" : ""} need attention.`,
      })
      return
    }
    addSalarySchedule({
      name: values.name,
      legalBasis: values.legalBasis,
      effectivityDate: values.effectivityDate,
      matrix: grid.map((row) => row.map((c) => pesos(c.trim().replace(/,/g, "")))),
    })
    const created = useDataStore.getState().salarySchedules.at(-1)
    toast.success("Salary schedule published", {
      description: `${values.name}, effective ${formatDate(values.effectivityDate)}.`,
    })
    if (created) onSaved(created.id)
  })

  const errorList = Array.from(gridErrors.entries()).slice(0, 4)

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>New salary schedule version</CardTitle>
          <CardDescription>
            Starts from {base.name}. Publishing adds a new version; earlier versions stay unchanged for payroll history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="ssl-name">Version name</FieldLabel>
            <Input id="ssl-name" placeholder="SSL VI Fourth Tranche" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.legalBasis}>
            <FieldLabel htmlFor="ssl-basis">Legal basis</FieldLabel>
            <Input
              id="ssl-basis"
              placeholder="EO 64 s. 2024; NBC No. 6XX"
              aria-invalid={!!errors.legalBasis}
              {...form.register("legalBasis")}
            />
            <FieldError errors={[errors.legalBasis]} />
          </Field>
          <Field data-invalid={!!errors.effectivityDate}>
            <FieldLabel htmlFor="ssl-date">Effectivity date</FieldLabel>
            <Input id="ssl-date" type="date" aria-invalid={!!errors.effectivityDate} {...form.register("effectivityDate")} />
            <FieldDescription>Must be after {formatDate(latestDate)}.</FieldDescription>
            <FieldError errors={[errors.effectivityDate]} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field className="w-auto" data-invalid={!!atbError}>
          <FieldLabel htmlFor="ssl-atb">Apply across-the-board increase (%)</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="ssl-atb"
              inputMode="decimal"
              placeholder="4"
              className="w-24 tabular-nums"
              value={atb}
              aria-invalid={!!atbError}
              onChange={(e) => setAtb(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyAtb()
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={applyAtb}>
              <PercentIcon data-icon="inline-start" />
              Apply to grid
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setGrid(baseGrid)
                setAtb("")
                setAtbError(null)
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
          </div>
          <FieldError>{atbError}</FieldError>
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Publish version</Button>
        </div>
      </div>

      {gridErrors.size > 0 && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>
            {gridErrors.size} cell{gridErrors.size > 1 ? "s" : ""} need attention
          </AlertTitle>
          <AlertDescription>
            {errorList.map(([key, msg]) => {
              const [g, s] = key.split("-")
              return (
                <span key={key} className="block">
                  SG {g}, Step {s}: {msg}
                </span>
              )
            })}
            {gridErrors.size > errorList.length && <span className="block">and {gridErrors.size - errorList.length} more</span>}
          </AlertDescription>
        </Alert>
      )}

      <div className="max-h-[calc(100svh-18rem)] min-h-80 overflow-auto rounded-lg border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Editable salary schedule in pesos per month</caption>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 border-r border-b bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Salary grade
              </th>
              {STEPS.map((s) => (
                <th
                  key={s}
                  scope="col"
                  className="sticky top-0 z-10 border-b bg-background px-2 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground"
                >
                  Step {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g) => (
              <tr key={g} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-[5] border-r border-b bg-background px-3 py-1 text-left font-medium tabular-nums group-hover:bg-muted"
                >
                  SG {g}
                </th>
                {STEPS.map((s) => {
                  const error = gridErrors.get(cellKey(g, s))
                  return (
                    <td key={s} className="border-b px-1 py-1 group-hover:bg-muted">
                      <Input
                        value={grid[g - 1]?.[s - 1] ?? ""}
                        onChange={(e) => setCell(g, s, e.target.value)}
                        inputMode="decimal"
                        aria-label={`SG ${g} Step ${s} monthly salary in pesos`}
                        aria-invalid={!!error}
                        title={error}
                        className={cn("h-7 min-w-24 text-right tabular-nums", error && "border-foreground border-dashed")}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  )
}
