"use client"

import { useParams } from "next/navigation"

import { useDataStore } from "@/stores/data-store"
import { RunDetail, RunNotFound } from "@/components/payroll/run-detail"

export default function SpecialPayrollRunPage() {
  const { id } = useParams<{ id: string }>()
  const run = useDataStore((s) => s.runs.find((r) => r.id === id))
  if (!run) return <RunNotFound backHref="/special-payroll" backLabel="Back to special payroll" />
  return <RunDetail run={run} backHref="/special-payroll" />
}
