"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import type { Remittance } from "@/types"
import { AGENCY_FULL, AGENCY_LABELS, HOSPITAL } from "@/lib/constants"
import { formatDate, formatMonthLong, formatNumber, registerName } from "@/lib/format"
import { remittanceSchedule } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useMockExport } from "@/hooks/use-mock-export"
import { InfoGrid } from "@/components/info-grid"
import { Money } from "@/components/money"
import { RemittanceStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { AGENCY_EXPORTS, AGENCY_ID_LABEL, agencyId } from "./agency-meta"
import { OverdueBadge } from "./overdue-badge"

const EMPLOYER_NO: Record<Remittance["agency"], string> = {
  gsis: HOSPITAL.gsisEmployerNo,
  philhealth: HOSPITAL.philhealthEmployerNo,
  pagibig: HOSPITAL.pagibigEmployerNo,
  bir: HOSPITAL.tin,
}

/** Per-employee remittance schedule for one agency and month. */
export function RemittanceSheet({
  remittance,
  open,
  onOpenChange,
}: {
  remittance: Remittance | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const runs = useDataStore((s) => s.runs)
  const employees = useDataStore((s) => s.employees)
  const exportFile = useMockExport()

  const rows = React.useMemo(
    () => (remittance ? remittanceSchedule(runs, employees, remittance.agency, remittance.month) : []),
    [runs, employees, remittance]
  )

  const totals = React.useMemo(
    () =>
      rows.reduce(
        (t, r) => ({ basis: t.basis + r.basis, ee: t.ee + r.employeeShare, er: t.er + r.governmentShare }),
        { basis: 0, ee: 0, er: 0 }
      ),
    [rows]
  )

  const isBir = remittance?.agency === "bir"

  return (
    <Sheet open={open && !!remittance} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full data-[side=right]:sm:max-w-4xl">
        {remittance && (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>
                  {AGENCY_LABELS[remittance.agency]} remittance schedule, {formatMonthLong(remittance.month)}
                </SheetTitle>
                <RemittanceStatusBadge status={remittance.status} />
                <OverdueBadge remittance={remittance} />
              </div>
              <SheetDescription>{AGENCY_FULL[remittance.agency]}</SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
              <InfoGrid
                columns={4}
                items={[
                  { label: isBir ? "Employer TIN" : "Employer No.", value: EMPLOYER_NO[remittance.agency], mono: true },
                  { label: "Employees", value: formatNumber(rows.length) },
                  { label: "Due date", value: formatDate(remittance.dueDate) },
                  { label: "Reference No.", value: remittance.referenceNo, mono: true },
                  {
                    label: isBir ? "Tax withheld" : "Total remittance",
                    value: <Money value={remittance.employeeShare + remittance.governmentShare} className="font-semibold" />,
                  },
                  { label: "Filed on", value: remittance.filedAt ? formatDate(remittance.filedAt) : undefined },
                  { label: "Paid on", value: remittance.paidAt ? formatDate(remittance.paidAt) : undefined },
                ]}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Employee schedule</h3>
                  <p className="text-xs text-muted-foreground">
                    Derived from every non-draft payroll run paid in {formatMonthLong(remittance.month)}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AGENCY_EXPORTS[remittance.agency].map((x) => (
                    <Button
                      key={x.label}
                      variant="outline"
                      size="sm"
                      disabled={rows.length === 0}
                      onClick={() =>
                        exportFile({
                          title: `${x.title}, ${formatMonthLong(remittance.month)}`,
                          format: x.format,
                          fileStem: `${x.stem}-${remittance.month.slice(0, 7)}`,
                          entity: "remittance",
                          entityId: remittance.id,
                          rows: rows.length,
                        })
                      }
                    >
                      <DownloadIcon data-icon="inline-start" aria-hidden />
                      {x.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table containerClassName="max-h-[calc(100svh-22rem)] overflow-auto" className="text-[0.8125rem]">
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8">Employee No.</TableHead>
                      <TableHead className="h-8">Name</TableHead>
                      <TableHead className="h-8">{AGENCY_ID_LABEL[remittance.agency]}</TableHead>
                      <TableHead className="h-8 text-right">{isBir ? "Taxable compensation" : "Monthly salary"}</TableHead>
                      <TableHead className="h-8 text-right">{isBir ? "Tax withheld" : "Employee share"}</TableHead>
                      {!isBir && <TableHead className="h-8 text-right">Employer share</TableHead>}
                      {!isBir && <TableHead className="h-8 text-right">Total</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={isBir ? 5 : 7} className="py-10 text-center text-muted-foreground">
                          No contributions were deducted for this month yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.employee.id} className="hover:bg-transparent">
                          <TableCell className="py-1.5 font-mono text-xs">{r.employee.employeeNo}</TableCell>
                          <TableCell className="py-1.5">{registerName(r.employee)}</TableCell>
                          <TableCell className="py-1.5 font-mono text-xs">{agencyId(remittance.agency, r.employee)}</TableCell>
                          <TableCell className="py-1.5 text-right">
                            <Money value={r.basis} plain />
                          </TableCell>
                          <TableCell className="py-1.5 text-right">
                            <Money value={r.employeeShare} plain muteZero />
                          </TableCell>
                          {!isBir && (
                            <TableCell className="py-1.5 text-right">
                              <Money value={r.governmentShare} plain muteZero />
                            </TableCell>
                          )}
                          {!isBir && (
                            <TableCell className="py-1.5 text-right font-medium">
                              <Money value={r.employeeShare + r.governmentShare} plain />
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {rows.length > 0 && (
                    <TableFooter className="sticky bottom-0 bg-muted">
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="py-1.5 font-medium">
                          Total, {formatNumber(rows.length)} employees
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-medium">
                          <Money value={totals.basis} plain />
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-medium">
                          <Money value={totals.ee} plain />
                        </TableCell>
                        {!isBir && (
                          <TableCell className="py-1.5 text-right font-medium">
                            <Money value={totals.er} plain />
                          </TableCell>
                        )}
                        {!isBir && (
                          <TableCell className="py-1.5 text-right font-semibold">
                            <Money value={totals.ee + totals.er} plain />
                          </TableCell>
                        )}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
