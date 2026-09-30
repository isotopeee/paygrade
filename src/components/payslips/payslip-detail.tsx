"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileQuestionIcon, PrinterIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useDataStore } from "@/stores/data-store"
import { useMockExport } from "@/hooks/use-mock-export"
import { PageContainer } from "@/components/page-header"
import { RunStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

import { Payslip } from "./payslip"
import { payslipRunLabel } from "./run-label"

export function PayslipDetail() {
  const params = useParams<{ runId: string; employeeId: string }>()
  const runId = decodeURIComponent(params.runId ?? "")
  const employeeId = decodeURIComponent(params.employeeId ?? "")
  const run = useDataStore((s) => s.runs.find((r) => r.id === runId))
  const employee = useDataStore((s) => s.employees.find((e) => e.id === employeeId))
  const exportFile = useMockExport()

  const ordered = React.useMemo(
    () => (run ? [...run.lines].sort((a, b) => a.employeeName.localeCompare(b.employeeName)) : []),
    [run]
  )
  const index = ordered.findIndex((l) => l.employeeId === employeeId)
  const line = index >= 0 ? ordered[index] : undefined
  const prev = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined
  const backHref = run ? `/payslips?run=${encodeURIComponent(run.id)}` : "/payslips"

  if (!run || !line || run.status === "draft") {
    return (
      <PageContainer>
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionIcon />
            </EmptyMedia>
            <EmptyTitle>Payslip not found</EmptyTitle>
            <EmptyDescription>
              {!run
                ? "The payroll run does not exist or was deleted."
                : run.status === "draft"
                  ? "This payroll run is still a draft. Payslips are available once it is computed."
                  : "This employee is not included in the selected payroll run."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" render={<Link href={backHref} />} nativeButton={false}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              Back to payslips
            </Button>
          </EmptyContent>
        </Empty>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="gap-4 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href={backHref} />} nativeButton={false}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            Payslips
          </Button>
          <span className="hidden truncate text-sm text-muted-foreground md:inline">
            <span className="font-mono text-xs">{run.code}</span>, {payslipRunLabel(run)}
          </span>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={prev ? `Previous employee, ${prev.employeeName}` : "No previous employee"}
              disabled={!prev}
              render={prev ? <Link href={`/payslips/${run.id}/${prev.employeeId}`} /> : undefined}
              nativeButton={!prev}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span className="px-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(index + 1)} of {formatNumber(ordered.length)}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={next ? `Next employee, ${next.employeeName}` : "No next employee"}
              disabled={!next}
              render={next ? <Link href={`/payslips/${run.id}/${next.employeeId}`} /> : undefined}
              nativeButton={!next}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" aria-hidden />
            Print
          </Button>
          <Button
            size="sm"
            onClick={() =>
              exportFile({
                title: `Payslip of ${line.employeeName}`,
                format: "PDF",
                fileStem: `payslip-${run.code}-${line.employeeNo}`,
                entity: "payslip",
                entityId: `${run.id}:${line.employeeId}`,
              })
            }
          >
            <DownloadIcon data-icon="inline-start" aria-hidden />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 print:overflow-visible print:pb-0">
        <Payslip run={run} line={line} employee={employee} className="min-w-[180mm] print:min-w-0" />
      </div>
    </PageContainer>
  )
}
