"use client"

import { LockIcon } from "lucide-react"

import { can } from "@/lib/permissions"
import { useRole } from "@/stores/session-store"
import { AuditLogView } from "@/components/audit/audit-log-view"
import { PageContainer } from "@/components/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function AuditLogPage() {
  const role = useRole()
  if (!can(role, "audit.view")) {
    return (
      <PageContainer>
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockIcon />
            </EmptyMedia>
            <EmptyTitle>No access to the audit log</EmptyTitle>
            <EmptyDescription>Your role cannot view audit entries.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageContainer>
    )
  }
  return <AuditLogView />
}
