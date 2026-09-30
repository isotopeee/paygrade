"use client"

import * as React from "react"

import type { Centavos, Employee, LineItem, PayrollLine, PayrollRun, Signatory } from "@/types"
import { GROUP_LABELS, HOSPITAL, SPECIAL_KIND_LABELS } from "@/lib/constants"
import { formatAmount, formatCurrency, formatDate, formatDateTime, formatPeriod, fullName } from "@/lib/format"
import { departmentName as lookupDepartment, ytdFor } from "@/lib/selectors"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"

export type PayslipYtd = ReturnType<typeof ytdFor>

export interface PayslipProps {
  run: PayrollRun
  line: PayrollLine
  /** Employee master record. Falls back to the snapshot on the payroll line when missing. */
  employee?: Employee
  /** Department name. Looked up from the store when omitted. */
  departmentName?: string
  /** "Certified correct" signatory. Uses the store's certified_by signatory when omitted. */
  certifiedBy?: Signatory
  /** Year-to-date totals. Computed with `ytdFor(runs, employeeId, run.payDate)` when omitted. */
  ytd?: PayslipYtd
  className?: string
}

function maskAccount(account: string | undefined): string {
  if (!account) return "Not set"
  const digits = account.replace(/\D/g, "")
  return `**** ${digits.slice(-4)}`
}

function rateLabel(employee: Employee | undefined, line: PayrollLine): string {
  if (employee?.rateType === "salary_grade" && employee.salaryGrade) {
    return `SG ${employee.salaryGrade}, Step ${employee.step ?? 1} (${formatCurrency(line.monthlyRate)} monthly)`
  }
  if (employee?.rateType === "daily" && employee.contractRate) {
    return `${formatCurrency(employee.contractRate)} daily`
  }
  return `${formatCurrency(line.monthlyRate)} monthly`
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Amount({ value, negative = false, className }: { value: Centavos; negative?: boolean; className?: string }) {
  const text = formatAmount(value)
  return (
    <span className={cn("tabular-nums", value === 0 && "text-black/40", className)}>
      {negative && value !== 0 ? `(${text})` : text}
    </span>
  )
}

function Row({
  label,
  value,
  negative,
  indent,
}: {
  label: React.ReactNode
  value: Centavos
  negative?: boolean
  indent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className={cn("min-w-0", indent && "pl-3 text-black/70")}>{label}</span>
      <Amount value={value} negative={negative} />
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: Centavos }) {
  return (
    <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-black/40 pt-1.5 font-semibold">
      <span>{label}</span>
      <span className="tabular-nums">{formatAmount(value)}</span>
    </div>
  )
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col", className)}>
      <h3 className="mb-1 flex items-baseline justify-between border-b border-black pb-1 text-[10px] font-semibold tracking-wider uppercase">
        <span>{title}</span>
        <span className="font-normal tracking-normal normal-case text-black/60">Amount (PHP)</span>
      </h3>
      {children}
    </section>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] tracking-wider text-black/60 uppercase">{label}</dt>
      <dd className={cn("truncate", mono && "font-mono text-[10.5px]")}>{value}</dd>
    </div>
  )
}

function ItemRows({ items, negative }: { items: LineItem[]; negative?: boolean }) {
  return (
    <>
      {items.map((item, i) => (
        <Row key={`${item.code}-${i}`} label={item.label} value={item.amount} negative={negative} indent />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Payslip                                                             */
/* ------------------------------------------------------------------ */

/**
 * Printable A4 payslip. Renders as white paper with black type in both themes.
 * Wrap it in a page that hides app chrome with `print:hidden`.
 */
export function Payslip({ run, line, employee, departmentName, certifiedBy, ytd, className }: PayslipProps) {
  const departments = useDataStore((s) => s.departments)
  const signatories = useDataStore((s) => s.signatories)
  const runs = useDataStore((s) => s.runs)

  const dept = departmentName ?? lookupDepartment(departments, line.departmentId)
  const signatory = certifiedBy ?? signatories.find((s) => s.role === "certified_by")
  const totals = React.useMemo(
    () => ytd ?? ytdFor(runs, line.employeeId, run.payDate),
    [ytd, runs, line.employeeId, run.payDate]
  )

  const isSpecial = run.type === "special"
  const isJoCos = line.group === "jo_cos"
  const name = employee ? fullName(employee) : line.employeeName
  const showStatutory = (value: Centavos) => !isJoCos || value !== 0
  const employerTotal = line.gsisGovernment + line.ecc + line.philhealthGovernment + line.pagibigGovernment

  return (
    <article
      aria-label={`Payslip of ${name} for ${run.code}`}
      className={cn(
        "print-sheet mx-auto w-full max-w-[210mm] rounded-sm border bg-white p-[12mm] text-[11px] leading-snug text-black shadow-sm print:text-[10.5px]",
        className
      )}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div className="min-w-0">
          <p className="text-[10px] text-black/70">Republic of the Philippines</p>
          <p className="text-[10px] text-black/70">Department of Health</p>
          <p className="mt-0.5 text-[13px] leading-tight font-semibold">{HOSPITAL.name}</p>
          <p className="text-[10px] text-black/70">{HOSPITAL.address}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[18px] leading-none font-bold tracking-[0.2em]">PAYSLIP</p>
          <p className="mt-1.5 font-mono text-[10.5px]">{run.code}</p>
          {isSpecial && <p className="text-[10px] font-medium">{run.specialKind ? SPECIAL_KIND_LABELS[run.specialKind] : run.title}</p>}
          <p className="text-[10px] text-black/70">Period: {formatPeriod(run.periodStart, run.periodEnd)}</p>
          <p className="text-[10px] text-black/70">Pay date: {formatDate(run.payDate)}</p>
        </div>
      </header>

      {/* Employee */}
      <dl className="grid grid-cols-4 gap-x-4 gap-y-2 border-b border-black/20 py-3">
        <Field label="Employee name" value={<span className="font-semibold">{name}</span>} />
        <Field label="Employee No." value={line.employeeNo} mono />
        <Field label="Position" value={line.positionTitle} />
        <Field label="Department" value={dept} />
        <Field label={employee?.rateType === "salary_grade" ? "Salary grade and step" : "Rate"} value={rateLabel(employee, line)} />
        <Field label="Payroll group" value={GROUP_LABELS[line.group]} />
        <Field label="TIN" value={employee?.tin ?? "Not set"} mono />
        <Field label="Bank account" value={maskAccount(employee?.bankAccountNo)} mono />
        <Field label="GSIS BP No." value={employee?.gsisBpNo ?? "Not covered"} mono />
        <Field label="PhilHealth No." value={employee?.philhealthNo ?? "Not set"} mono />
        <Field label="Pag-IBIG MID" value={employee?.pagibigMid ?? "Not set"} mono />
      </dl>

      {/* Earnings and deductions */}
      <div className="grid grid-cols-2 gap-6 py-3">
        <Section title="Earnings">
          {isSpecial ? (
            <>
              <ItemRows items={line.allowances} />
              {line.otherEarnings.length > 0 && <ItemRows items={line.otherEarnings} />}
            </>
          ) : (
            <>
              <Row label="Basic salary" value={line.basicScheduled} />
              <Row label="Less: tardiness and undertime" value={line.tardinessUndertime} negative indent />
              <Row label="Less: absences without pay" value={line.absences} negative indent />
              {(!isJoCos || line.pera !== 0) && <Row label="PERA" value={line.pera} />}
              <ItemRows items={line.allowances} />
              <Row label="Overtime" value={line.overtime} />
              <Row label="Night differential" value={line.nightDiff} />
              {line.otherEarnings.length > 0 && (
                <>
                  <p className="pt-1 text-[9px] tracking-wider text-black/60 uppercase">Other earnings</p>
                  <ItemRows items={line.otherEarnings} />
                </>
              )}
            </>
          )}
          <div className="flex-1" />
          <TotalRow label="Gross pay" value={line.gross} />
        </Section>

        <Section title="Deductions">
          {showStatutory(line.gsis) && <Row label="GSIS personal share" value={line.gsis} />}
          {showStatutory(line.philhealth) && <Row label="PhilHealth" value={line.philhealth} />}
          {showStatutory(line.pagibig) && <Row label="Pag-IBIG" value={line.pagibig} />}
          <Row label="Withholding tax" value={line.withholdingTax} />
          {line.loans.length > 0 && (
            <>
              <p className="pt-1 text-[9px] tracking-wider text-black/60 uppercase">Loans</p>
              <ItemRows items={line.loans} />
            </>
          )}
          {line.otherDeductions.length > 0 && (
            <>
              <p className="pt-1 text-[9px] tracking-wider text-black/60 uppercase">Other deductions</p>
              <ItemRows items={line.otherDeductions} />
            </>
          )}
          <div className="flex-1" />
          <TotalRow label="Total deductions" value={line.totalDeductions} />
        </Section>
      </div>

      {/* Net pay */}
      <div className="flex items-center justify-between gap-4 border-y-2 border-black px-1 py-2.5">
        <div>
          <p className="text-[11px] font-semibold tracking-wider uppercase">Net pay</p>
          <p className="text-[9.5px] text-black/60">
            Credited to account {maskAccount(employee?.bankAccountNo)} on {formatDate(run.payDate)}
          </p>
        </div>
        <p className="text-[22px] leading-none font-bold tabular-nums">{formatCurrency(line.net)}</p>
      </div>

      {isSpecial && (
        <p className="mt-2 rounded-sm border border-black/20 px-2 py-1.5 text-[9.5px] text-black/75">
          Special payroll. The 13th month pay and other benefits, including the mid-year and year-end bonuses, are exempt
          from income tax up to PHP 90,000 per year under RA 10963 (TRAIN Law). Any excess is added to taxable compensation
          and withheld accordingly. Amounts on this slip are separate from the regular monthly payroll.
        </p>
      )}

      {/* Employer share and YTD */}
      <div className="grid grid-cols-2 gap-6 pt-3">
        <section>
          <h3 className="mb-1 border-b border-black/40 pb-1 text-[9.5px] font-semibold tracking-wider uppercase">
            Employer contributions (for information)
          </h3>
          <Row label="GSIS government share" value={line.gsisGovernment} />
          <Row label="Employees' Compensation (ECC)" value={line.ecc} />
          <Row label="PhilHealth government share" value={line.philhealthGovernment} />
          <Row label="Pag-IBIG government share" value={line.pagibigGovernment} />
          <TotalRow label="Total employer share" value={employerTotal} />
        </section>
        <section>
          <h3 className="mb-1 border-b border-black/40 pb-1 text-[9.5px] font-semibold tracking-wider uppercase">
            Year to date, {run.payDate.slice(0, 4)}
          </h3>
          <Row label="Gross compensation" value={totals.gross} />
          <Row label="Withholding tax" value={totals.tax} />
          <Row label="GSIS personal share" value={totals.gsis} />
          <Row label="PhilHealth" value={totals.philhealth} />
          <Row label="Pag-IBIG" value={totals.pagibig} />
          <TotalRow label="Net pay" value={totals.net} />
        </section>
      </div>

      {/* Signatures */}
      <footer className="mt-6">
        <div className="grid grid-cols-2 gap-10">
          <div>
            <p className="text-[9.5px] text-black/60">Certified correct:</p>
            <div className="mt-7 border-t border-black pt-1 text-center">
              <p className="font-semibold uppercase">{signatory?.name ?? "Accountant"}</p>
              <p className="text-[9.5px] text-black/70">{signatory?.position ?? "Certifying officer"}</p>
            </div>
          </div>
          <div>
            <p className="text-[9.5px] text-black/60">Received by:</p>
            <div className="mt-7 border-t border-black pt-1 text-center">
              <p className="font-semibold uppercase">{name}</p>
              <p className="text-[9.5px] text-black/70">Signature over printed name and date</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-black/20 pt-1.5 text-[9px] text-black/55">
          <span>System-generated payslip. Prototype data only.</span>
          <span className="tabular-nums">
            {run.payslipsGeneratedAt ? `Generated ${formatDateTime(run.payslipsGeneratedAt)}` : "Preview, payslips not yet generated"}
            {" · "}
            {HOSPITAL.short} PayGrade
          </span>
        </div>
      </footer>
    </article>
  )
}
