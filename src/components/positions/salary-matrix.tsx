"use client"

import type { Centavos } from "@/types"
import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

export const GRADES = Array.from({ length: 33 }, (_, i) => i + 1)
export const STEPS = Array.from({ length: 8 }, (_, i) => i + 1)

function formatChange(current: Centavos, previous: Centavos): string {
  if (previous === 0) return "0%"
  const pct = ((current - previous) / previous) * 100
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : ""
  return `${sign}${Math.abs(pct).toFixed(2)}%`
}

/**
 * Read-only salary schedule: SG 1 to 33 rows by Step 1 to 8 columns, with a
 * sticky header row and sticky grade column inside a scroll container.
 */
export function SalaryMatrix({
  matrix,
  previous,
  previousName,
  caption,
}: {
  matrix: Centavos[][]
  previous?: Centavos[][]
  previousName?: string
  caption: string
}) {
  return (
    <div className="max-h-[calc(100svh-18rem)] min-h-80 overflow-auto rounded-lg border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-20 border-r border-b bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground"
            >
              Salary grade
            </th>
            {STEPS.map((s) => (
              <th
                key={s}
                scope="col"
                className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground"
              >
                Step {s}
              </th>
            ))}
            {previous && (
              <th
                scope="col"
                className="sticky top-0 z-10 border-b border-l bg-background px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground"
                title={previousName ? `Step 1 change versus ${previousName}` : undefined}
              >
                Step 1 change
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {GRADES.map((g) => {
            const row = matrix[g - 1] ?? []
            const prevStep1 = previous?.[g - 1]?.[0]
            return (
              <tr key={g} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-[5] border-r border-b bg-background px-3 py-1.5 text-left font-medium tabular-nums group-last:border-b-0 group-hover:bg-muted"
                >
                  SG {g}
                </th>
                {STEPS.map((s) => (
                  <td
                    key={s}
                    className="border-b px-3 py-1.5 text-right tabular-nums group-last:border-b-0 group-hover:bg-muted"
                  >
                    {formatAmount(row[s - 1] ?? 0)}
                  </td>
                ))}
                {previous && (
                  <td
                    className={cn(
                      "border-b border-l px-3 py-1.5 text-right text-muted-foreground tabular-nums group-last:border-b-0 group-hover:bg-muted"
                    )}
                  >
                    {prevStep1 !== undefined ? formatChange(row[0] ?? 0, prevStep1) : ""}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
