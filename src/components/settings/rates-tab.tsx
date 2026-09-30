"use client"

import { useMemo, useState } from "react"
import { CheckCircle2Icon, CopyPlusIcon } from "lucide-react"

import { formatDate, formatDateTime } from "@/lib/format"
import { ratesForDate } from "@/lib/payroll/rates"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { RatesDetail } from "./rates-detail"
import { RatesVersionSheet, SEED_NOTE } from "./rates-form"
import { LockNote, TabIntro } from "./settings-shared"

export function RatesTab({ canManage }: { canManage: boolean }) {
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const versions = useMemo(
    () => [...ratesVersions].sort((a, b) => b.effectivityDate.localeCompare(a.effectivityDate)),
    [ratesVersions]
  )
  const inForce = useMemo(() => ratesForDate(ratesVersions, DEMO_TODAY), [ratesVersions])
  const [selectedDate, setSelectedDate] = useState(inForce.effectivityDate)
  const [sheetOpen, setSheetOpen] = useState(false)
  const selected = versions.find((v) => v.effectivityDate === selectedDate) ?? inForce
  const existingDates = useMemo(() => versions.map((v) => v.effectivityDate), [versions])

  return (
    <div className="flex flex-col gap-4">
      <TabIntro
        title="Contribution and tax tables"
        description="Versioned GSIS, PhilHealth, Pag-IBIG, withholding tax, and benefit rates. The payroll engine uses the version in force on each period's start date."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <CopyPlusIcon data-icon="inline-start" aria-hidden />
              Create new version
            </Button>
          ) : (
            <LockNote />
          )
        }
      />
      <p className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{SEED_NOTE}</p>

      <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="Rates versions" className="flex flex-col gap-2 lg:sticky lg:top-4">
          {versions.map((v) => {
            const active = v.effectivityDate === selected.effectivityDate
            const current = v.id === inForce.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedDate(v.effectivityDate)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "border-foreground bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{v.label}</span>
                  {current ? (
                    <Badge className="gap-1">
                      <CheckCircle2Icon data-icon="inline-start" aria-hidden />
                      In force
                    </Badge>
                  ) : v.effectivityDate > DEMO_TODAY ? (
                    <Badge variant="outline">Scheduled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Superseded
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Effective {formatDate(v.effectivityDate)}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{v.legalBasis}</span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  {v.createdBy}, {formatDateTime(v.createdAt)}
                </span>
              </button>
            )
          })}
        </nav>
        <RatesDetail rates={selected} />
      </div>

      {canManage && (
        <RatesVersionSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          source={selected}
          existingDates={existingDates}
          onCreated={setSelectedDate}
        />
      )}
    </div>
  )
}
