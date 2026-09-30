"use client"

import * as React from "react"
import { CalendarCheckIcon, CircleCheckBigIcon, CircleDotIcon, ClockIcon, PauseCircleIcon, PauseIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"

import type { Employee, Loan } from "@/types"
import { LOAN_TYPE_AGENCY, LOAN_TYPE_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatMonth, formatMonthLong, registerName } from "@/lib/format"
import { amortizationSchedule, loanBalance, loanProgress, type ScheduleStatus } from "@/lib/loans"
import { useDataStore } from "@/stores/data-store"
import { InfoGrid } from "@/components/info-grid"
import { Money } from "@/components/money"
import { LoanStatusBadge, StatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/** Month the payroll is currently deducting, relative to the demo date. */
export const CURRENT_DEDUCTION_MONTH = "2026-09-01"

const SCHEDULE_STATUS: Record<ScheduleStatus, { label: string; icon: typeof ClockIcon; tone: "solid" | "muted" | "outline" }> = {
  deducted: { label: "Deducted", icon: CircleCheckBigIcon, tone: "solid" },
  current: { label: "Current", icon: CircleDotIcon, tone: "muted" },
  scheduled: { label: "Scheduled", icon: ClockIcon, tone: "outline" },
  suspended: { label: "Suspended", icon: PauseCircleIcon, tone: "outline" },
}

export function LoanSheet({
  loan,
  employee,
  canManage,
  open,
  onOpenChange,
}: {
  loan: Loan | undefined
  employee: Employee | undefined
  canManage: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setLoanStatus = useDataStore((s) => s.setLoanStatus)
  const [confirming, setConfirming] = React.useState(false)
  const current = loan

  const schedule = React.useMemo(
    () => (current ? amortizationSchedule(current, CURRENT_DEDUCTION_MONTH) : []),
    [current]
  )

  const suspending = current?.status === "active"

  const confirm = () => {
    if (!current) return
    const next = suspending ? "suspended" : "active"
    setLoanStatus(current.id, next)
    toast.success(suspending ? "Deduction suspended" : "Deduction resumed", {
      description: `${current.referenceNo} ${suspending ? "will be skipped starting the current payroll month" : "will be deducted again starting the current payroll month"}.`,
    })
    setConfirming(false)
  }

  return (
    <Sheet open={open && !!loan} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full data-[side=right]:sm:max-w-3xl">
        {current && (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>{LOAN_TYPE_LABELS[current.type]}</SheetTitle>
                <LoanStatusBadge status={current.status} />
              </div>
              <SheetDescription>
                <span className="font-mono text-xs">{current.referenceNo}</span>
                {employee ? `, ${registerName(employee)} (${employee.employeeNo})` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
              <InfoGrid
                columns={4}
                items={[
                  { label: "Agency or creditor", value: LOAN_TYPE_AGENCY[current.type] },
                  { label: "Principal", value: <Money value={current.principal} /> },
                  { label: "Total payable", value: <Money value={current.totalPayable} /> },
                  { label: "Monthly amortization", value: <Money value={current.monthlyAmortization} /> },
                  { label: "Term", value: `${current.termMonths} months` },
                  { label: "First deduction", value: formatMonthLong(current.startPeriod) },
                  { label: "Last deduction", value: formatDate(current.endPeriod) },
                  { label: "Position", value: employee?.positionTitle },
                  { label: "Paid to date", value: <Money value={current.paidToDate} /> },
                  { label: "Outstanding balance", value: <Money value={loanBalance(current)} className="font-semibold" /> },
                ]}
              />

              <Progress value={loanProgress(current)} aria-label="Repayment progress" className="gap-1.5">
                <span className="text-xs text-muted-foreground">Repayment progress</span>
                <span className="ml-auto text-xs tabular-nums">{loanProgress(current)}%</span>
              </Progress>

              <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Amortization schedule</h3>
                    <p className="text-xs text-muted-foreground">
                      The full monthly amortization is deducted in every monthly payroll.
                    </p>
                  </div>
                  <CalendarCheckIcon className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <Table containerClassName="max-h-[50svh] overflow-auto" className="text-[0.8125rem]">
                    <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 w-10 text-right">No.</TableHead>
                        <TableHead className="h-8">Month</TableHead>
                        <TableHead className="h-8 text-right">Amortization</TableHead>
                        <TableHead className="h-8 text-right">Cumulative paid</TableHead>
                        <TableHead className="h-8 text-right">Balance</TableHead>
                        <TableHead className="h-8">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((row) => {
                        const s = SCHEDULE_STATUS[row.status]
                        return (
                          <TableRow
                            key={row.month}
                            data-state={row.status === "current" ? "selected" : undefined}
                            className="hover:bg-transparent"
                          >
                            <TableCell className="py-1.5 text-right text-muted-foreground tabular-nums">{row.index}</TableCell>
                            <TableCell className="py-1.5 tabular-nums">{formatMonth(row.month)}</TableCell>
                            <TableCell className="py-1.5 text-right">
                              <Money value={row.amortization} plain />
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <Money value={row.cumulativePaid} plain />
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <Money value={row.balance} plain muteZero />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <StatusBadge label={s.label} icon={s.icon} tone={s.tone} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter className="sticky bottom-0 bg-muted">
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="py-1.5" />
                        <TableCell className="py-1.5 font-medium">Total</TableCell>
                        <TableCell className="py-1.5 text-right font-medium">
                          <Money value={schedule.reduce((n, r) => n + r.amortization, 0)} plain />
                        </TableCell>
                        <TableCell colSpan={5} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            </div>

            {canManage && current.status !== "fully_paid" && (
              <SheetFooter className="flex-row justify-end border-t">
                <Button variant="outline" onClick={() => setConfirming(true)}>
                  {suspending ? <PauseIcon data-icon="inline-start" aria-hidden /> : <PlayIcon data-icon="inline-start" aria-hidden />}
                  {suspending ? "Suspend deduction" : "Resume deduction"}
                </Button>
              </SheetFooter>
            )}

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{suspending ? "Suspend this deduction?" : "Resume this deduction?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {suspending
                      ? `${current.referenceNo} will not be deducted from payroll starting ${formatMonthLong(CURRENT_DEDUCTION_MONTH)} until it is resumed. Keep the creditor's written authority on file.`
                      : `${current.referenceNo} will be deducted again at ${formatCurrency(current.monthlyAmortization)} per month starting ${formatMonthLong(CURRENT_DEDUCTION_MONTH)}.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirm}>{suspending ? "Suspend deduction" : "Resume deduction"}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
