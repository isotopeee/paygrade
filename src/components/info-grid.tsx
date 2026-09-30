import { cn } from "@/lib/utils"

export interface InfoItem {
  label: string
  value: React.ReactNode
  mono?: boolean
  span?: 1 | 2 | 3
}

/** Label and value pairs for profile and detail panels. */
export function InfoGrid({ items, columns = 3, className }: { items: InfoItem[]; columns?: 2 | 3 | 4; className?: string }) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("min-w-0 space-y-1", item.span === 2 && "sm:col-span-2", item.span === 3 && "sm:col-span-2 lg:col-span-3")}
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("truncate", item.mono && "font-mono text-xs")}>{item.value ?? <span className="text-muted-foreground">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
