"use client"

import { format, parseISO } from "date-fns"

import type { DtrDailyEntry } from "@/types"
import { totalsOf } from "@/lib/attendance"
import { formatHours } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function Num({ value, hours = false }: { value: number; hours?: boolean }) {
  if (value === 0) return <span className="text-muted-foreground/50">0</span>
  return <>{hours ? formatHours(value) : value}</>
}

/** Daily time record table (CS Form No. 48 layout) with a totals row. */
export function DailyRecordTable({ entries }: { entries: DtrDailyEntry[] }) {
  const totals = totalsOf(entries)
  const cell = "px-2 py-1.5"
  return (
    <div className="overflow-hidden rounded-lg border print:rounded-none print:border-foreground">
      <Table className="text-[0.8125rem]" containerClassName="print:overflow-visible">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cell}>Date</TableHead>
            <TableHead className={cell}>Day</TableHead>
            <TableHead className={cn(cell, "text-right")}>AM In</TableHead>
            <TableHead className={cn(cell, "text-right")}>AM Out</TableHead>
            <TableHead className={cn(cell, "text-right")}>PM In</TableHead>
            <TableHead className={cn(cell, "text-right")}>PM Out</TableHead>
            <TableHead className={cn(cell, "text-right")}>Late (min)</TableHead>
            <TableHead className={cn(cell, "text-right")}>Undertime (min)</TableHead>
            <TableHead className={cn(cell, "text-right")}>OT (h)</TableHead>
            <TableHead className={cn(cell, "text-right")}>ND (h)</TableHead>
            <TableHead className={cell}>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const muted = e.kind === "weekend" || e.kind === "holiday" || e.kind === "not_employed"
            const isOff = e.kind === "leave" || e.kind === "absent"
            return (
              <TableRow
                key={e.date}
                className={cn(muted && "bg-muted/40 text-muted-foreground", e.kind === "absent" && "font-medium")}
              >
                <TableCell className={cn(cell, "whitespace-nowrap tabular-nums")}>{format(parseISO(e.date), "MMM d")}</TableCell>
                <TableCell className={cell}>{e.weekday}</TableCell>
                {isOff ? (
                  <TableCell colSpan={4} className={cn(cell, "text-center text-xs tracking-wide uppercase")}>
                    {e.kind === "leave" ? "On leave" : "Absent"}
                  </TableCell>
                ) : (
                  <>
                    <TableCell className={cn(cell, "text-right whitespace-nowrap tabular-nums")}>{e.amIn ?? ""}</TableCell>
                    <TableCell className={cn(cell, "text-right whitespace-nowrap tabular-nums")}>{e.amOut ?? ""}</TableCell>
                    <TableCell className={cn(cell, "text-right whitespace-nowrap tabular-nums")}>{e.pmIn ?? ""}</TableCell>
                    <TableCell className={cn(cell, "text-right whitespace-nowrap tabular-nums")}>{e.pmOut ?? ""}</TableCell>
                  </>
                )}
                <TableCell className={cn(cell, "text-right tabular-nums")}>
                  <Num value={e.lateMinutes} />
                </TableCell>
                <TableCell className={cn(cell, "text-right tabular-nums")}>
                  <Num value={e.undertimeMinutes} />
                </TableCell>
                <TableCell className={cn(cell, "text-right tabular-nums")}>
                  <Num value={e.overtimeHours} hours />
                </TableCell>
                <TableCell className={cn(cell, "text-right tabular-nums")}>
                  <Num value={e.nightDiffHours} hours />
                </TableCell>
                <TableCell className={cn(cell, "text-xs")}>{e.remarks ?? ""}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className={cn(cell, "font-medium")}>
              Total
            </TableCell>
            <TableCell className={cn(cell, "text-right font-medium tabular-nums")}>{totals.lateMinutes}</TableCell>
            <TableCell className={cn(cell, "text-right font-medium tabular-nums")}>{totals.undertimeMinutes}</TableCell>
            <TableCell className={cn(cell, "text-right font-medium tabular-nums")}>{formatHours(totals.overtimeHours)}</TableCell>
            <TableCell className={cn(cell, "text-right font-medium tabular-nums")}>{formatHours(totals.nightDiffHours)}</TableCell>
            <TableCell className={cell} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
