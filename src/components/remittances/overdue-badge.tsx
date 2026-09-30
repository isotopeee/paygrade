import { TriangleAlertIcon } from "lucide-react"

import type { Remittance } from "@/types"
import { StatusBadge } from "@/components/status-badge"

import { isOverdue } from "./agency-meta"

/** Outline "Overdue" badge for pending remittances past their due date. */
export function OverdueBadge({ remittance }: { remittance: Pick<Remittance, "status" | "dueDate"> }) {
  if (!isOverdue(remittance)) return null
  return <StatusBadge label="Overdue" icon={TriangleAlertIcon} tone="outline" className="font-semibold" />
}
