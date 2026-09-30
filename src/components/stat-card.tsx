import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  children,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          {Icon && <Icon className="size-4" aria-hidden />}
        </div>
        <div className="text-lg leading-tight font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] xl:text-xl 2xl:text-2xl">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {children}
      </CardContent>
    </Card>
  )
}
