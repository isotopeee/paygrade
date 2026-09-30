"use client"

import { useMemo } from "react"

import type { PayrollPeriod } from "@/types"
import { formatPeriod } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

/** Last period start with attendance data in the demo (the current payroll month). */
export const LAST_DTR_PERIOD_START = "2026-09-01"

/** Periods that can carry DTR records, newest first. */
export function useDtrPeriods(): PayrollPeriod[] {
  const periods = useDataStore((s) => s.periods)
  return useMemo(
    () => periods.filter((p) => p.start <= LAST_DTR_PERIOD_START).sort((a, b) => b.start.localeCompare(a.start)),
    [periods]
  )
}

export function PeriodSelect({
  value,
  onChange,
  id = "dtr-period",
  className,
}: {
  value: string
  onChange: (periodId: string) => void
  id?: string
  className?: string
}) {
  const periods = useDtrPeriods()
  return (
    <NativeSelect
      id={id}
      aria-label="Payroll period"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {periods.map((p) => (
        <NativeSelectOption key={p.id} value={p.id}>
          {formatPeriod(p.start, p.end)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
