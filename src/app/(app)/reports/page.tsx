"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { REPORTS } from "@/lib/reports"
import { PageContainer, PageHeader } from "@/components/page-header"
import { REPORT_ICONS } from "@/components/reports/report-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ReportsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Government payroll forms, BIR schedules, and management reports generated from computed payroll runs."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = REPORT_ICONS[report.slug]
          return (
            <Link
              key={report.slug}
              href={`/reports/${report.slug}`}
              className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/40">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg border bg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <ChevronRightIcon
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <CardTitle>{report.name}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Reference:</span> {report.reference}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </PageContainer>
  )
}
