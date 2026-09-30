"use client"

import { PageContainer, PageHeader } from "@/components/page-header"
import { PlantillaTab } from "@/components/positions/plantilla-tab"
import { SalaryScheduleTab } from "@/components/positions/salary-schedule-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PositionsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Positions and Salary Schedule"
        description="Plantilla items authorized for MMWGH and the Salary Standardization Law schedule used to compute basic pay."
      />
      <Tabs defaultValue="plantilla" className="gap-4">
        <TabsList>
          <TabsTrigger value="plantilla">Plantilla positions</TabsTrigger>
          <TabsTrigger value="schedule">Salary schedule</TabsTrigger>
        </TabsList>
        <TabsContent value="plantilla">
          <PlantillaTab />
        </TabsContent>
        <TabsContent value="schedule">
          <SalaryScheduleTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
