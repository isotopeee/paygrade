import { FileQuestionIcon } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function NoRunsState({
  title = "No payroll runs to report",
  description = "Reports use computed payroll runs. Compute a run in Payroll Runs, then return here.",
}: {
  title?: string
  description?: string
}) {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
