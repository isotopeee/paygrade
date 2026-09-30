import { LockIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function LockNote({ className }: { className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <LockIcon className="size-3.5" aria-hidden />
      Only the System Admin can change settings.
    </p>
  )
}

export function TabIntro({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="max-w-3xl text-xs text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
