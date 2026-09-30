"use client"

import { useParams } from "next/navigation"

import { useDataStore } from "@/stores/data-store"
import { RunDetail, RunNotFound } from "@/components/payroll/run-detail"

export default function PayrollRunPage() {
  const { id } = useParams<{ id: string }>()
  const run = useDataStore((s) => s.runs.find((r) => r.id === id))
  if (!run) return <RunNotFound backHref="/payroll" backLabel="Back to payroll runs" />
  return <RunDetail run={run} backHref={run.type === "special" ? "/special-payroll" : "/payroll"} />
}
