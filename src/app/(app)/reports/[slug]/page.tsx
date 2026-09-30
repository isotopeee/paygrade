"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { FileQuestionIcon } from "lucide-react"

import { reportBySlug, type ReportSlug, type ReportMeta } from "@/lib/reports"
import { PageContainer } from "@/components/page-header"
import { AlphalistReport } from "@/components/reports/alphalist-report"
import { Bir2316Report } from "@/components/reports/bir-2316-report"
import { DepartmentSummaryReport } from "@/components/reports/department-summary-report"
import { GeneralPayrollReport } from "@/components/reports/general-payroll-report"
import { LeaveMonetizationReport } from "@/components/reports/leave-monetization-report"
import { PayrollRegisterReport } from "@/components/reports/payroll-register-report"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

const COMPONENTS: Record<ReportSlug, React.ComponentType<{ meta: ReportMeta }>> = {
  "general-payroll": GeneralPayrollReport,
  "payroll-register": PayrollRegisterReport,
  "summary-by-department": DepartmentSummaryReport,
  "bir-2316": Bir2316Report,
  alphalist: AlphalistReport,
  "leave-monetization": LeaveMonetizationReport,
}

export default function ReportPage() {
  const params = useParams<{ slug: string }>()
  const meta = reportBySlug(params.slug ?? "")

  if (!meta) {
    return (
      <PageContainer>
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionIcon />
            </EmptyMedia>
            <EmptyTitle>Report not found</EmptyTitle>
            <EmptyDescription>There is no report at this address. Choose a report from the list.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" render={<Link href="/reports" />} nativeButton={false}>
              Back to Reports
            </Button>
          </EmptyContent>
        </Empty>
      </PageContainer>
    )
  }

  const Report = COMPONENTS[meta.slug]
  return <Report key={meta.slug} meta={meta} />
}
