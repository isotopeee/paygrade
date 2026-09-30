"use client"

import Link from "next/link"
import {
  ArrowLeftIcon,
  BookUserIcon,
  Building2Icon,
  CalendarCheckIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ListOrderedIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  type LucideIcon,
} from "lucide-react"

import type { ReportMeta, ReportSlug } from "@/lib/reports"
import { can } from "@/lib/permissions"
import { useRole } from "@/stores/session-store"
import { useMockExport } from "@/hooks/use-mock-export"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export const REPORT_ICONS: Record<ReportSlug, LucideIcon> = {
  "general-payroll": ScrollTextIcon,
  "payroll-register": ListOrderedIcon,
  "summary-by-department": Building2Icon,
  "bir-2316": ReceiptTextIcon,
  alphalist: BookUserIcon,
  "leave-monetization": CalendarCheckIcon,
}

export function ReportLayout({
  meta,
  filters,
  fileStem,
  rows,
  exportDisabled,
  children,
}: {
  meta: ReportMeta
  filters?: React.ReactNode
  fileStem: string
  rows?: number
  exportDisabled?: boolean
  children: React.ReactNode
}) {
  const role = useRole()
  const exportFile = useMockExport()
  const canExport = can(role, "reports.export")
  const Icon = REPORT_ICONS[meta.slug]

  const run = (format: "PDF" | "Excel") =>
    exportFile({ title: meta.name, format, fileStem, rows, entity: "report", entityId: fileStem })

  return (
    <PageContainer>
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground" render={<Link href="/reports" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Reports
        </Button>
      </div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden />
            {meta.reference}
          </span>
        }
        title={meta.name}
        description={meta.description}
        actions={
          canExport && (
            <>
              <Button variant="outline" size="sm" onClick={() => run("PDF")} disabled={exportDisabled}>
                <FileTextIcon data-icon="inline-start" aria-hidden />
                Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => run("Excel")} disabled={exportDisabled}>
                <FileSpreadsheetIcon data-icon="inline-start" aria-hidden />
                Export Excel
              </Button>
            </>
          )
        }
      />
      {filters && (
        <Card size="sm">
          <CardContent className="flex flex-wrap items-end gap-3">{filters}</CardContent>
        </Card>
      )}
      {children}
    </PageContainer>
  )
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className ?? "w-64 max-w-full"}>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

export function ReportNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
