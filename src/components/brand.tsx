import { cn } from "@/lib/utils"

/** PayGrade mark: three ascending bars in a rounded square, drawn in currentColor. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[55%]" fill="currentColor">
        <rect x="3" y="13" width="4.5" height="8" rx="1" />
        <rect x="9.75" y="8" width="4.5" height="13" rx="1" />
        <rect x="16.5" y="3" width="4.5" height="18" rx="1" />
      </svg>
    </span>
  )
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      Pay<span className="font-normal">Grade</span>
    </span>
  )
}
