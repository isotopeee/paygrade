import { CheckIcon, LockIcon } from "lucide-react"

import type { PayrollRun, RunTransition } from "@/types"
import { ROLE_LABELS, RUN_STATUS_LABELS } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { statusIndex, WORKFLOW_STEPS } from "@/lib/workflow"

/** Latest transition into each status (a run can pass a stage more than once after a return). */
function latestTransitions(history: RunTransition[]): Map<string, RunTransition> {
  const map = new Map<string, RunTransition>()
  for (const h of history) if (!h.returned) map.set(h.status, h)
  return map
}

export function WorkflowStepper({
  run,
  compact = false,
  className,
}: {
  run: Pick<PayrollRun, "status" | "history" | "locked">
  compact?: boolean
  className?: string
}) {
  const current = statusIndex(run.status)
  const transitions = latestTransitions(run.history)

  return (
    <ol
      className={cn("grid grid-cols-3 gap-y-4 sm:grid-cols-6", className)}
      aria-label={`Payroll workflow, current status ${RUN_STATUS_LABELS[run.status]}`}
    >
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i <= current
        const isCurrent = i === current + 1
        const transition = done ? transitions.get(step.status) : undefined
        const label = RUN_STATUS_LABELS[step.status]
        return (
          <li
            key={step.status}
            className="relative flex min-w-0 flex-col items-start gap-2 pr-3"
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums",
                  done && "border-foreground bg-foreground text-background",
                  isCurrent && "border-foreground bg-background text-foreground ring-4 ring-foreground/10",
                  !done && !isCurrent && "border-dashed border-muted-foreground/50 text-muted-foreground"
                )}
              >
                {done ? (
                  step.status === "approved" && run.locked ? (
                    <LockIcon className="size-3" aria-hidden />
                  ) : (
                    <CheckIcon className="size-3.5" aria-hidden />
                  )
                ) : (
                  i + 1
                )}
              </span>
              {i < WORKFLOW_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "ml-2 h-px flex-1",
                    i < current ? "bg-foreground" : "border-t border-dashed border-muted-foreground/40 bg-transparent"
                  )}
                />
              )}
            </div>
            <div className="w-full min-w-0 space-y-0.5">
              <div className={cn("text-xs font-medium", !done && !isCurrent && "text-muted-foreground")}>
                {label}
                <span className="sr-only">{done ? ", completed" : isCurrent ? ", awaiting action" : ", upcoming"}</span>
              </div>
              {!compact && (
                <div className="text-[11px] leading-snug text-muted-foreground">
                  {transition ? (
                    <>
                      <div className="truncate">{transition.by}</div>
                      <div className="tabular-nums">{formatDateTime(transition.at)}</div>
                    </>
                  ) : isCurrent ? (
                    <div className="font-medium text-foreground">Awaiting {ROLE_LABELS[step.actor]}</div>
                  ) : (
                    <div>{ROLE_LABELS[step.actor]}</div>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
