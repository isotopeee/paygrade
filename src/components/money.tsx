import type { Centavos } from "@/types"
import { formatAmount, formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Peso amount with tabular figures. `plain` drops the peso sign for dense registers. */
export function Money({
  value,
  plain = false,
  muteZero = false,
  negative = false,
  className,
}: {
  value: Centavos
  plain?: boolean
  muteZero?: boolean
  /** Render as a deduction, for example (1,234.00). */
  negative?: boolean
  className?: string
}) {
  const text = plain ? formatAmount(value) : formatCurrency(value)
  return (
    <span className={cn("tabular-nums", muteZero && value === 0 && "text-muted-foreground/60", className)}>
      {negative && value !== 0 ? `(${text})` : text}
    </span>
  )
}
