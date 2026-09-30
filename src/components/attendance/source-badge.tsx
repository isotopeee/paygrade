import { CircleAlertIcon, FileUpIcon, FingerprintIcon, PencilIcon, type LucideIcon } from "lucide-react"

import type { DtrSummary } from "@/types"
import { StatusBadge } from "@/components/status-badge"

export const SOURCE_LABELS: Record<DtrSummary["source"], string> = {
  biometric: "Biometric",
  import: "Import",
  manual: "Manual",
}

const SOURCE: Record<DtrSummary["source"], { icon: LucideIcon; tone: "solid" | "muted" | "outline" }> = {
  biometric: { icon: FingerprintIcon, tone: "solid" },
  import: { icon: FileUpIcon, tone: "muted" },
  manual: { icon: PencilIcon, tone: "muted" },
}

export function DtrSourceBadge({ source }: { source: DtrSummary["source"] | undefined }) {
  if (!source) return <StatusBadge label="No logs" icon={CircleAlertIcon} tone="outline" />
  const s = SOURCE[source]
  return <StatusBadge label={SOURCE_LABELS[source]} icon={s.icon} tone={s.tone} />
}
