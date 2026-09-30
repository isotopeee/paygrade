"use client"

import { BuildingIcon, HandCoinsIcon, PenLineIcon, PercentIcon, UsersIcon } from "lucide-react"

import { can } from "@/lib/permissions"
import { useRole } from "@/stores/session-store"
import { PageContainer, PageHeader } from "@/components/page-header"
import { AllowancesTab } from "@/components/settings/allowances-tab"
import { DepartmentsTab } from "@/components/settings/departments-tab"
import { RatesTab } from "@/components/settings/rates-tab"
import { LockNote } from "@/components/settings/settings-shared"
import { SignatoriesTab } from "@/components/settings/signatories-tab"
import { UsersTab } from "@/components/settings/users-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SettingsPage() {
  const role = useRole()
  const canManage = can(role, "settings.manage")

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Contribution and tax tables, allowances, departments, signatories, and user access."
        actions={canManage ? undefined : <LockNote />}
      />
      <Tabs defaultValue="rates" className="gap-4">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList>
            <TabsTrigger value="rates">
              <PercentIcon aria-hidden />
              Contribution and tax tables
            </TabsTrigger>
            <TabsTrigger value="allowances">
              <HandCoinsIcon aria-hidden />
              Allowances
            </TabsTrigger>
            <TabsTrigger value="departments">
              <BuildingIcon aria-hidden />
              Departments
            </TabsTrigger>
            <TabsTrigger value="signatories">
              <PenLineIcon aria-hidden />
              Signatories
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon aria-hidden />
              Users and roles
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="rates">
          <RatesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="allowances">
          <AllowancesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="signatories">
          <SignatoriesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab canManage={canManage && can(role, "users.manage")} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
