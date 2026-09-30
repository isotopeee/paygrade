"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  AwardIcon,
  BiohazardIcon,
  GiftIcon,
  PlusIcon,
  ShirtIcon,
  SparklesIcon,
  UtensilsIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { SpecialPayrollKind } from "@/types"
import { SPECIAL_KIND_BASIS, SPECIAL_KIND_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, fullName } from "@/lib/format"
import { computeSpecialLines, monthRange, specialAsOf, specialEligibility, type EngineData } from "@/lib/payroll/engine"
import { sumBy } from "@/lib/payroll/money"
import { can } from "@/lib/permissions"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { PageContainer, PageHeader } from "@/components/page-header"
import { RunsTable } from "@/components/payroll/runs-table"
import { RunStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"

const KINDS: { kind: SpecialPayrollKind; icon: LucideIcon; defaultMonth: string; payDay: string }[] = [
  { kind: "mid_year_bonus", icon: AwardIcon, defaultMonth: "2026-05-01", payDay: "2026-05-15" },
  { kind: "year_end_bonus", icon: GiftIcon, defaultMonth: "2026-11-01", payDay: "2026-11-13" },
  { kind: "pei", icon: SparklesIcon, defaultMonth: "2026-12-01", payDay: "2026-12-15" },
  { kind: "hazard_pay", icon: BiohazardIcon, defaultMonth: "2026-09-01", payDay: "2026-10-09" },
  { kind: "subsistence_laundry", icon: UtensilsIcon, defaultMonth: "2026-09-01", payDay: "2026-10-09" },
  { kind: "uniform_allowance", icon: ShirtIcon, defaultMonth: "2026-02-01", payDay: "2026-02-20" },
]

const MONTHS = Array.from({ length: 16 }, (_, i) => {
  const d = new Date(2025, 9 + i, 1)
  return format(d, "yyyy-MM-01")
})

function titleFor(kind: SpecialPayrollKind, month: string) {
  const annual = kind === "mid_year_bonus" || kind === "year_end_bonus" || kind === "pei" || kind === "uniform_allowance"
  return `${SPECIAL_KIND_LABELS[kind]}, ${annual ? `CY ${month.slice(0, 4)}` : format(parseISO(month), "MMMM yyyy")}`
}

function CreateSpecialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const runs = useDataStore((s) => s.runs)
  const employees = useDataStore((s) => s.employees)
  const dtr = useDataStore((s) => s.dtr)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const allowanceTypes = useDataStore((s) => s.allowanceTypes)
  const loans = useDataStore((s) => s.loans)
  const periods = useDataStore((s) => s.periods)
  const createRun = useDataStore((s) => s.createRun)
  const data: EngineData = useMemo(
    () => ({ employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods }),
    [employees, dtr, salarySchedules, ratesVersions, allowanceTypes, loans, periods]
  )

  const [kind, setKind] = useState<SpecialPayrollKind>("hazard_pay")
  const [month, setMonth] = useState("2026-09-01")
  const [payDate, setPayDate] = useState("2026-10-09")

  const { start, end } = monthRange(month)
  const eligibility = useMemo(() => specialEligibility(data, kind, start, end), [data, kind, start, end])
  const preview = useMemo(
    () =>
      computeSpecialLines(
        data,
        { specialKind: kind, employeeIds: eligibility.eligible.map((e) => e.id), periodStart: start, periodEnd: end },
        []
      ),
    [data, kind, eligibility, start, end]
  )
  const duplicate = runs.find((r) => r.type === "special" && r.specialKind === kind && r.periodStart === start)

  const chooseKind = (k: SpecialPayrollKind) => {
    setKind(k)
    const preset = KINDS.find((x) => x.kind === k)
    if (preset && (k !== "hazard_pay" && k !== "subsistence_laundry")) {
      setMonth(preset.defaultMonth)
      setPayDate(preset.payDay)
    }
  }

  const submit = () => {
    const id = createRun({
      type: "special",
      group: "plantilla",
      specialKind: kind,
      periodStart: start,
      periodEnd: end,
      payDate,
      employeeIds: eligibility.eligible.map((e) => e.id),
      title: titleFor(kind, month),
      computeNow: true,
    })
    toast.success("Special payroll created and computed", { description: titleFor(kind, month) })
    onOpenChange(false)
    router.push(`/special-payroll/${id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create special payroll</DialogTitle>
          <DialogDescription>
            Special payroll follows the same Draft to Released workflow with a simplified register. Plantilla employees only.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field className="sm:col-span-3">
              <FieldLabel htmlFor="sp-kind">Benefit</FieldLabel>
              <NativeSelect id="sp-kind" value={kind} onChange={(e) => chooseKind(e.target.value as SpecialPayrollKind)}>
                {KINDS.map((k) => (
                  <NativeSelectOption key={k.kind} value={k.kind}>
                    {SPECIAL_KIND_LABELS[k.kind]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{SPECIAL_KIND_BASIS[kind]}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="sp-month">Covered month</FieldLabel>
              <NativeSelect id="sp-month" value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {format(parseISO(m), "MMMM yyyy")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="sp-paydate">Pay date</FieldLabel>
              <Input id="sp-paydate" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Eligibility reference date</FieldLabel>
              <div className="flex h-8 items-center text-sm">{formatDate(specialAsOf(kind, start, end))}</div>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Eligible</div>
              <div className="font-medium tabular-nums">{eligibility.eligible.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Not eligible</div>
              <div className="font-medium tabular-nums">{eligibility.ineligible.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Estimated total</div>
              <div className="font-medium tabular-nums">{formatCurrency(sumBy(preview, (l) => l.net))}</div>
            </div>
          </div>

          {eligibility.ineligible.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Not eligible</div>
              <ScrollArea className="max-h-40 rounded-lg border">
                <ul className="divide-y text-sm">
                  {eligibility.ineligible.map(({ employee, reason }) => (
                    <li key={employee.id} className="flex flex-wrap justify-between gap-2 px-3 py-1.5">
                      <span>{fullName(employee)}</span>
                      <span className="text-xs text-muted-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {duplicate && (
            <p className="rounded-lg border border-dashed p-3 text-sm">
              A {SPECIAL_KIND_LABELS[kind]} run already exists for this month:{" "}
              <Link href={`/special-payroll/${duplicate.id}`} className="font-medium underline">
                {duplicate.code}
              </Link>
              . Creating another may double-pay employees.
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={eligibility.eligible.length === 0 || !payDate}>
            Create and compute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SpecialPayrollContent() {
  const role = useRole()
  const params = useSearchParams()
  const runs = useDataStore((s) => s.runs)
  const special = useMemo(() => runs.filter((r) => r.type === "special"), [runs])
  const [open, setOpen] = useState(params.get("create") === "1" && can(role, "payroll.create"))

  return (
    <PageContainer>
      <PageHeader
        title="Special Payroll"
        description="Bonuses and Magna Carta benefits paid outside the regular monthly payroll: Mid-Year and Year-End Bonus, Cash Gift, PEI, Hazard Pay, Subsistence and Laundry, and Uniform Allowance."
        actions={
          can(role, "payroll.create") && (
            <Button onClick={() => setOpen(true)}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              Create special payroll
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {KINDS.map(({ kind, icon: Icon }) => {
          const kindRuns = special.filter((r) => r.specialKind === kind).sort((a, b) => b.payDate.localeCompare(a.payDate))
          const latest = kindRuns[0]
          const paid2026 = sumBy(
            kindRuns.filter((r) => r.status === "released" && r.payDate.startsWith("2026")),
            (r) => r.totals.net
          )
          return (
            <Card key={kind} size="sm">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-sm leading-snug">{SPECIAL_KIND_LABELS[kind]}</CardTitle>
                  <p className="text-xs text-muted-foreground">Released in 2026: {formatCurrency(paid2026)}</p>
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                {latest ? (
                  <Link
                    href={`/special-payroll/${latest.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-muted-foreground">Latest</span>
                      <span className="block truncate">{latest.title}</span>
                    </span>
                    <RunStatusBadge status={latest.status} />
                  </Link>
                ) : (
                  <p className="rounded-md border border-dashed px-2.5 py-2 text-xs text-muted-foreground">No runs yet</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <RunsTable
        runs={special}
        special
        emptyState={{
          icon: <GiftIcon />,
          title: "No special payroll runs",
          description: "Create a run for a bonus or Magna Carta benefit.",
        }}
      />
      {can(role, "payroll.create") && <CreateSpecialDialog open={open} onOpenChange={setOpen} />}
    </PageContainer>
  )
}

export default function SpecialPayrollPage() {
  return (
    <Suspense>
      <SpecialPayrollContent />
    </Suspense>
  )
}
