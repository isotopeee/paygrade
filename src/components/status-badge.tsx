import {
  BadgeCheckIcon,
  BanIcon,
  CalculatorIcon,
  CheckIcon,
  CircleCheckBigIcon,
  CircleDashedIcon,
  CircleDotIcon,
  ClockIcon,
  EyeIcon,
  FileCheckIcon,
  LockIcon,
  PauseCircleIcon,
  PlaneIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react"

import type { EmployeeStatus, LoanStatus, RemittanceStatus, RunStatus } from "@/types"
import {
  EMPLOYEE_STATUS_LABELS,
  LOAN_STATUS_LABELS,
  REMITTANCE_STATUS_LABELS,
  RUN_STATUS_LABELS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Monochrome status badges. Status is carried by three visual weights and an
 * icon, never by color:
 * - solid: finished or active states
 * - muted: in progress
 * - outline: not started or inactive
 */
type Tone = "solid" | "muted" | "outline"

const TONE_VARIANT = {
  solid: "default",
  muted: "secondary",
  outline: "outline",
} as const

export function StatusBadge({
  label,
  icon: Icon,
  tone,
  className,
}: {
  label: string
  icon: LucideIcon
  tone: Tone
  className?: string
}) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className={cn("gap-1 font-medium", className)}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  )
}

const RUN: Record<RunStatus, { icon: LucideIcon; tone: Tone }> = {
  draft: { icon: CircleDashedIcon, tone: "outline" },
  computed: { icon: CalculatorIcon, tone: "outline" },
  reviewed: { icon: EyeIcon, tone: "muted" },
  certified: { icon: BadgeCheckIcon, tone: "muted" },
  approved: { icon: LockIcon, tone: "solid" },
  released: { icon: CircleCheckBigIcon, tone: "solid" },
}

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const s = RUN[status]
  return <StatusBadge label={RUN_STATUS_LABELS[status]} icon={s.icon} tone={s.tone} className={className} />
}

const EMPLOYEE: Record<EmployeeStatus, { icon: LucideIcon; tone: Tone }> = {
  active: { icon: CircleDotIcon, tone: "solid" },
  on_leave: { icon: PlaneIcon, tone: "muted" },
  suspended: { icon: BanIcon, tone: "outline" },
  separated: { icon: UserXIcon, tone: "outline" },
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const s = EMPLOYEE[status]
  return (
    <StatusBadge
      label={EMPLOYEE_STATUS_LABELS[status]}
      icon={s.icon}
      tone={s.tone}
      className={status === "separated" ? "text-muted-foreground" : undefined}
    />
  )
}

const REMITTANCE: Record<RemittanceStatus, { icon: LucideIcon; tone: Tone }> = {
  pending: { icon: ClockIcon, tone: "outline" },
  filed: { icon: FileCheckIcon, tone: "muted" },
  paid: { icon: CheckIcon, tone: "solid" },
}

export function RemittanceStatusBadge({ status }: { status: RemittanceStatus }) {
  const s = REMITTANCE[status]
  return <StatusBadge label={REMITTANCE_STATUS_LABELS[status]} icon={s.icon} tone={s.tone} />
}

const LOAN: Record<LoanStatus, { icon: LucideIcon; tone: Tone }> = {
  active: { icon: CircleDotIcon, tone: "solid" },
  fully_paid: { icon: CheckIcon, tone: "outline" },
  suspended: { icon: PauseCircleIcon, tone: "muted" },
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  const s = LOAN[status]
  return <StatusBadge label={LOAN_STATUS_LABELS[status]} icon={s.icon} tone={s.tone} />
}
