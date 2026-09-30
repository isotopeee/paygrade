"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type {
  Adjustment,
  AllowanceType,
  AppUser,
  AuditEntity,
  AuditEntry,
  Department,
  DtrSummary,
  Employee,
  EmployeeGroup,
  Loan,
  LoanStatus,
  PayrollLine,
  PayrollRun,
  Position,
  RatesConfig,
  RemittanceFiling,
  RunStatus,
  SalarySchedule,
  Signatory,
  SpecialPayrollKind,
} from "@/types"
import { GROUP_LABELS, RUN_STATUS_LABELS, SPECIAL_KIND_LABELS } from "@/lib/constants"
import { formatCurrency, formatPeriod, fullName } from "@/lib/format"
import { computeRunLines, type EngineData } from "@/lib/payroll/engine"
import { EMPTY_TOTALS, computeRunTotals } from "@/lib/payroll/totals"
import { isLocked, nextStatus } from "@/lib/workflow"
import { createSeed, type DemoData } from "@/data/seed"

import { currentActor } from "./session-store"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let idCounter = 0
export function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`
}

function now(): string {
  return new Date().toISOString()
}

export function engineData(state: DemoData): EngineData {
  return {
    employees: state.employees,
    salarySchedules: state.salarySchedules,
    ratesVersions: state.ratesVersions,
    allowanceTypes: state.allowanceTypes,
    dtr: state.dtr,
    loans: state.loans,
    periods: state.periods,
  }
}

export function runLabel(run: Pick<PayrollRun, "code" | "type" | "periodStart" | "periodEnd" | "title">): string {
  return run.type === "regular"
    ? `${run.code} (${formatPeriod(run.periodStart, run.periodEnd)})`
    : `${run.code} (${run.title})`
}

const TRANSITION_VERBS: Record<RunStatus, string> = {
  draft: "Created payroll run",
  computed: "Computed payroll",
  reviewed: "Marked payroll as reviewed",
  certified: "Certified payroll",
  approved: "Approved payroll",
  released: "Released payroll",
}

function recompute(state: DemoData, run: PayrollRun): PayrollRun {
  const lines: PayrollLine[] = computeRunLines(engineData(state), run, run.adjustments)
  return { ...run, lines, totals: computeRunTotals(lines) }
}

/* ------------------------------------------------------------------ */
/* Seed and persistence                                                */
/* ------------------------------------------------------------------ */

let seedCache: DemoData | null = null
function seed(): DemoData {
  seedCache ??= createSeed()
  return seedCache
}

/** Runs that were released in the seed. Their lines are frozen and not persisted. */
function seedReleasedLines(): Map<string, PayrollLine[]> {
  return new Map(seed().runs.filter((r) => r.status === "released").map((r) => [r.id, r.lines]))
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface CreateRunInput {
  type: "regular" | "special"
  group: EmployeeGroup
  periodId?: string
  periodStart: string
  periodEnd: string
  payDate: string
  specialKind?: SpecialPayrollKind
  employeeIds: string[]
  title?: string
  computeNow?: boolean
  note?: string
}

export interface NewAdjustment {
  employeeId: string
  kind: Adjustment["kind"]
  label: string
  amount: number
  reason: string
}

interface Actions {
  resetDemo: () => void
  logAudit: (entry: {
    action: string
    entity: AuditEntity
    entityId: string
    entityLabel: string
    before?: string
    after?: string
  }) => void

  // Employees and positions
  addEmployee: (employee: Omit<Employee, "id">) => string
  updateEmployee: (id: string, patch: Partial<Employee>) => void
  upsertPosition: (position: Position) => void

  // Attendance
  importDtr: (records: DtrSummary[], label: string) => void
  updateDtr: (record: DtrSummary) => void

  // Payroll runs
  createRun: (input: CreateRunInput) => string
  computeRun: (runId: string) => void
  advanceRun: (runId: string, comment?: string) => void
  returnRun: (runId: string, to: RunStatus, reason: string) => void
  addAdjustment: (runId: string, adjustment: NewAdjustment) => void
  removeAdjustment: (runId: string, adjustmentId: string, reason: string) => void
  addComment: (runId: string, body: string) => void
  generatePayslips: (runIds: string[]) => void
  deleteDraftRun: (runId: string) => void

  // Loans
  addLoan: (loan: Omit<Loan, "id">) => void
  setLoanStatus: (loanId: string, status: LoanStatus) => void

  // Remittances
  setRemittanceFiling: (key: string, label: string, filing: RemittanceFiling) => void

  // Settings
  addRatesVersion: (rates: Omit<RatesConfig, "id" | "createdAt" | "createdBy">) => void
  addSalarySchedule: (schedule: Omit<SalarySchedule, "id" | "createdAt" | "createdBy">) => string
  upsertAllowanceType: (allowance: AllowanceType) => void
  upsertDepartment: (department: Department) => void
  updateSignatory: (signatory: Signatory) => void
  upsertUser: (user: AppUser) => void
}

export type DataState = DemoData & Actions

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => {
      const log: Actions["logAudit"] = (entry) => {
        const actor = currentActor()
        const item: AuditEntry = { id: uid("audit"), at: now(), userName: actor.name, role: actor.role, ...entry }
        set((s) => ({ audit: [item, ...s.audit] }))
      }

      const updateRun = (runId: string, fn: (run: PayrollRun, state: DataState) => PayrollRun) => {
        set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? fn(r, s) : r)) }))
      }

      const getRun = (runId: string) => {
        const run = get().runs.find((r) => r.id === runId)
        if (!run) throw new Error(`Run ${runId} not found`)
        return run
      }

      return {
        ...seed(),

        resetDemo: () => {
          seedCache = null
          set({ ...seed() })
        },

        logAudit: log,

        /* Employees -------------------------------------------------- */
        addEmployee: (employee) => {
          const id = uid("emp")
          set((s) => ({ employees: [...s.employees, { ...employee, id }] }))
          log({
            action: "Added employee",
            entity: "employee",
            entityId: id,
            entityLabel: `${fullName(employee)} (${employee.employeeNo})`,
            after: `${employee.positionTitle}, hired ${employee.dateHired}`,
          })
          return id
        },

        updateEmployee: (id, patch) => {
          const before = get().employees.find((e) => e.id === id)
          if (!before) return
          set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
          const changed = (Object.keys(patch) as (keyof Employee)[]).filter(
            (k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k])
          )
          if (changed.length === 0) return
          log({
            action: "Updated employee",
            entity: "employee",
            entityId: id,
            entityLabel: `${fullName(before)} (${before.employeeNo})`,
            before: changed.map((k) => `${k}: ${String(before[k] ?? "")}`).join("; "),
            after: changed.map((k) => `${k}: ${String(patch[k] ?? "")}`).join("; "),
          })
        },

        upsertPosition: (position) => {
          const exists = get().positions.some((p) => p.id === position.id)
          set((s) => ({
            positions: exists ? s.positions.map((p) => (p.id === position.id ? position : p)) : [...s.positions, position],
          }))
          log({
            action: exists ? "Updated plantilla position" : "Created plantilla position",
            entity: "position",
            entityId: position.id,
            entityLabel: `${position.itemNo} (${position.title})`,
            after: `SG ${position.salaryGrade}`,
          })
        },

        /* Attendance ------------------------------------------------- */
        importDtr: (records, label) => {
          set((s) => {
            const keys = new Set(records.map((r) => `${r.periodId}:${r.employeeId}`))
            return { dtr: [...s.dtr.filter((d) => !keys.has(`${d.periodId}:${d.employeeId}`)), ...records] }
          })
          log({
            action: "Imported biometric logs",
            entity: "dtr",
            entityId: records[0]?.periodId ?? "",
            entityLabel: label,
            after: `${records.length} records imported`,
          })
        },

        updateDtr: (record) => {
          set((s) => ({
            dtr: s.dtr.some((d) => d.periodId === record.periodId && d.employeeId === record.employeeId)
              ? s.dtr.map((d) => (d.periodId === record.periodId && d.employeeId === record.employeeId ? record : d))
              : [...s.dtr, record],
          }))
          const employee = get().employees.find((e) => e.id === record.employeeId)
          log({
            action: "Updated DTR",
            entity: "dtr",
            entityId: `${record.periodId}:${record.employeeId}`,
            entityLabel: employee ? `${fullName(employee)}, ${record.periodId}` : record.periodId,
            after: `${record.daysWorked} days worked, ${record.tardinessMinutes} min late`,
          })
        },

        /* Payroll runs ----------------------------------------------- */
        createRun: (input) => {
          const actor = currentActor()
          const id = uid("run")
          const at = now()
          const specialLabel = input.specialKind ? SPECIAL_KIND_LABELS[input.specialKind] : ""
          const code =
            input.type === "regular"
              ? `REG-${input.periodStart.slice(0, 7)}-${input.group === "plantilla" ? "PL" : "JC"}`
              : `SPL-${input.periodStart.slice(0, 7)}-${(input.specialKind ?? "").split("_").map((w) => w[0]?.toUpperCase()).join("")}`
          const run: PayrollRun = {
            id,
            code,
            type: input.type,
            specialKind: input.specialKind,
            title: input.title ?? (input.type === "regular" ? `Regular Payroll, ${GROUP_LABELS[input.group]}` : specialLabel),
            group: input.group,
            periodId: input.periodId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            payDate: input.payDate,
            status: "draft",
            employeeIds: input.employeeIds,
            lines: [],
            adjustments: [],
            comments: input.note
              ? [{ id: uid("c"), author: actor.name, role: actor.role, createdAt: at, body: input.note, kind: "comment" }]
              : [],
            history: [{ status: "draft", by: actor.name, role: actor.role, at }],
            totals: EMPTY_TOTALS,
            createdBy: actor.name,
            createdAt: at,
            locked: false,
          }
          set((s) => ({ runs: [run, ...s.runs] }))
          log({
            action: "Created payroll run",
            entity: "payroll_run",
            entityId: id,
            entityLabel: runLabel(run),
            after: `${input.employeeIds.length} employees, status Draft`,
          })
          if (input.computeNow) get().computeRun(id)
          return id
        },

        computeRun: (runId) => {
          const actor = currentActor()
          const before = getRun(runId)
          if (before.locked) return
          updateRun(runId, (run, s) => {
            const computed = recompute(s, run)
            const at = now()
            const history = run.status === "draft" ? [...run.history, { status: "computed" as const, by: actor.name, role: actor.role, at }] : run.history
            const comments =
              run.status === "draft"
                ? [
                    ...run.comments,
                    {
                      id: uid("c"),
                      author: actor.name,
                      role: actor.role,
                      createdAt: at,
                      body: "",
                      kind: "transition" as const,
                      fromStatus: "draft" as const,
                      toStatus: "computed" as const,
                    },
                  ]
                : run.comments
            return { ...computed, status: run.status === "draft" ? "computed" : run.status, history, comments }
          })
          const after = getRun(runId)
          log({
            action: before.status === "draft" ? "Computed payroll" : "Recomputed payroll",
            entity: "payroll_run",
            entityId: runId,
            entityLabel: runLabel(after),
            before: before.status === "draft" ? "Status: draft" : `Net: ${formatCurrency(before.totals.net)}`,
            after: `Status: ${after.status}; ${after.totals.headcount} employees; net ${formatCurrency(after.totals.net)}`,
          })
        },

        advanceRun: (runId, comment) => {
          const actor = currentActor()
          const run = getRun(runId)
          const to = nextStatus(run.status)
          if (!to) return
          if (run.status === "draft") {
            get().computeRun(runId)
            return
          }
          const at = now()
          updateRun(runId, (r) => ({
            ...r,
            status: to,
            locked: isLocked(to),
            history: [...r.history, { status: to, by: actor.name, role: actor.role, at }],
            comments: [
              ...r.comments,
              {
                id: uid("c"),
                author: actor.name,
                role: actor.role,
                createdAt: at,
                body: comment ?? "",
                kind: "transition",
                fromStatus: r.status,
                toStatus: to,
              },
            ],
          }))
          log({
            action: TRANSITION_VERBS[to],
            entity: "payroll_run",
            entityId: runId,
            entityLabel: runLabel(run),
            before: `Status: ${run.status}`,
            after: `Status: ${to}${isLocked(to) ? " (locked)" : ""}`,
          })
        },

        returnRun: (runId, to, reason) => {
          const actor = currentActor()
          const run = getRun(runId)
          const at = now()
          updateRun(runId, (r) => ({
            ...r,
            status: to,
            locked: false,
            history: [...r.history, { status: to, by: actor.name, role: actor.role, at, returned: true }],
            comments: [
              ...r.comments,
              {
                id: uid("c"),
                author: actor.name,
                role: actor.role,
                createdAt: at,
                body: reason,
                kind: "return",
                fromStatus: r.status,
                toStatus: to,
              },
            ],
          }))
          log({
            action: `Returned payroll to ${RUN_STATUS_LABELS[to]}`,
            entity: "payroll_run",
            entityId: runId,
            entityLabel: runLabel(run),
            before: `Status: ${run.status}`,
            after: `Status: ${to}. Reason: ${reason}`,
          })
        },

        addAdjustment: (runId, adjustment) => {
          const actor = currentActor()
          const run = getRun(runId)
          const beforeLine = run.lines.find((l) => l.employeeId === adjustment.employeeId)
          const item: Adjustment = { ...adjustment, id: uid("adj"), createdBy: actor.name, createdAt: now() }
          updateRun(runId, (r, s) => recompute(s, { ...r, adjustments: [...r.adjustments, item] }))
          const afterLine = getRun(runId).lines.find((l) => l.employeeId === adjustment.employeeId)
          log({
            action: `Added manual ${adjustment.kind === "earning" ? "earning" : "deduction"}`,
            entity: "adjustment",
            entityId: item.id,
            entityLabel: `${beforeLine?.employeeName ?? adjustment.employeeId} in ${run.code}`,
            before: beforeLine ? `Net: ${formatCurrency(beforeLine.net)}` : undefined,
            after: `${adjustment.label} ${formatCurrency(adjustment.amount)}; net ${afterLine ? formatCurrency(afterLine.net) : ""}. Reason: ${adjustment.reason}`,
          })
        },

        removeAdjustment: (runId, adjustmentId, reason) => {
          const run = getRun(runId)
          const adj = run.adjustments.find((a) => a.id === adjustmentId)
          if (!adj) return
          const beforeLine = run.lines.find((l) => l.employeeId === adj.employeeId)
          updateRun(runId, (r, s) => recompute(s, { ...r, adjustments: r.adjustments.filter((a) => a.id !== adjustmentId) }))
          const afterLine = getRun(runId).lines.find((l) => l.employeeId === adj.employeeId)
          log({
            action: "Removed manual adjustment",
            entity: "adjustment",
            entityId: adjustmentId,
            entityLabel: `${beforeLine?.employeeName ?? adj.employeeId} in ${run.code}`,
            before: `${adj.label} ${formatCurrency(adj.amount)}; net ${beforeLine ? formatCurrency(beforeLine.net) : ""}`,
            after: `Removed; net ${afterLine ? formatCurrency(afterLine.net) : ""}. Reason: ${reason}`,
          })
        },

        addComment: (runId, body) => {
          const actor = currentActor()
          updateRun(runId, (r) => ({
            ...r,
            comments: [
              ...r.comments,
              { id: uid("c"), author: actor.name, role: actor.role, createdAt: now(), body, kind: "comment" },
            ],
          }))
        },

        generatePayslips: (runIds) => {
          const at = now()
          set((s) => ({ runs: s.runs.map((r) => (runIds.includes(r.id) ? { ...r, payslipsGeneratedAt: at } : r)) }))
          for (const id of runIds) {
            const run = getRun(id)
            log({
              action: "Generated payslips",
              entity: "payslip",
              entityId: id,
              entityLabel: runLabel(run),
              after: `${run.lines.length} payslips`,
            })
          }
        },

        deleteDraftRun: (runId) => {
          const run = getRun(runId)
          if (run.status !== "draft") return
          set((s) => ({ runs: s.runs.filter((r) => r.id !== runId) }))
          log({ action: "Deleted draft payroll run", entity: "payroll_run", entityId: runId, entityLabel: runLabel(run) })
        },

        /* Loans ------------------------------------------------------ */
        addLoan: (loan) => {
          const id = uid("loan")
          set((s) => ({ loans: [...s.loans, { ...loan, id }] }))
          const employee = get().employees.find((e) => e.id === loan.employeeId)
          log({
            action: "Added loan or deduction",
            entity: "loan",
            entityId: id,
            entityLabel: `${loan.referenceNo}${employee ? `, ${fullName(employee)}` : ""}`,
            after: `${formatCurrency(loan.monthlyAmortization)} monthly, ${loan.startPeriod} to ${loan.endPeriod}`,
          })
        },

        setLoanStatus: (loanId, status) => {
          const loan = get().loans.find((l) => l.id === loanId)
          if (!loan) return
          set((s) => ({ loans: s.loans.map((l) => (l.id === loanId ? { ...l, status } : l)) }))
          log({
            action: "Changed loan status",
            entity: "loan",
            entityId: loanId,
            entityLabel: loan.referenceNo,
            before: loan.status,
            after: status,
          })
        },

        /* Remittances ------------------------------------------------ */
        setRemittanceFiling: (key, label, filing) => {
          const before = get().remittanceFilings[key]
          set((s) => ({ remittanceFilings: { ...s.remittanceFilings, [key]: filing } }))
          log({
            action: filing.status === "paid" ? "Marked remittance as paid" : filing.status === "filed" ? "Marked remittance as filed" : "Updated remittance",
            entity: "remittance",
            entityId: key,
            entityLabel: label,
            before: before ? before.status : "pending",
            after: `${filing.status}${filing.referenceNo ? ` (${filing.referenceNo})` : ""}`,
          })
        },

        /* Settings --------------------------------------------------- */
        addRatesVersion: (rates) => {
          const actor = currentActor()
          const id = uid("rates")
          set((s) => ({ ratesVersions: [...s.ratesVersions, { ...rates, id, createdAt: now(), createdBy: actor.name }] }))
          log({
            action: "Published rates version",
            entity: "rates",
            entityId: id,
            entityLabel: `${rates.label} (effective ${rates.effectivityDate})`,
          })
        },

        addSalarySchedule: (schedule) => {
          const actor = currentActor()
          const id = uid("ssl")
          set((s) => ({ salarySchedules: [...s.salarySchedules, { ...schedule, id, createdAt: now(), createdBy: actor.name }] }))
          log({
            action: "Published salary schedule version",
            entity: "salary_schedule",
            entityId: id,
            entityLabel: `${schedule.name} (effective ${schedule.effectivityDate})`,
          })
          return id
        },

        upsertAllowanceType: (allowance) => {
          const before = get().allowanceTypes.find((a) => a.id === allowance.id)
          set((s) => ({
            allowanceTypes: before
              ? s.allowanceTypes.map((a) => (a.id === allowance.id ? allowance : a))
              : [...s.allowanceTypes, allowance],
          }))
          log({
            action: before ? "Updated allowance type" : "Added allowance type",
            entity: "allowance",
            entityId: allowance.id,
            entityLabel: allowance.name,
            before: before ? `${formatCurrency(before.defaultMonthly)}, ${before.active ? "active" : "inactive"}` : undefined,
            after: `${formatCurrency(allowance.defaultMonthly)}, ${allowance.active ? "active" : "inactive"}`,
          })
        },

        upsertDepartment: (department) => {
          const before = get().departments.find((d) => d.id === department.id)
          set((s) => ({
            departments: before
              ? s.departments.map((d) => (d.id === department.id ? department : d))
              : [...s.departments, department],
          }))
          log({
            action: before ? "Updated department" : "Added department",
            entity: "department",
            entityId: department.id,
            entityLabel: department.name,
            before: before ? `${before.code}, ${before.costCenter}, head ${before.head}` : undefined,
            after: `${department.code}, ${department.costCenter}, head ${department.head}`,
          })
        },

        updateSignatory: (signatory) => {
          const before = get().signatories.find((s) => s.id === signatory.id)
          set((s) => ({ signatories: s.signatories.map((x) => (x.id === signatory.id ? signatory : x)) }))
          log({
            action: "Updated signatory",
            entity: "signatory",
            entityId: signatory.id,
            entityLabel: signatory.label,
            before: before ? `${before.name}, ${before.position}` : undefined,
            after: `${signatory.name}, ${signatory.position}`,
          })
        },

        upsertUser: (user) => {
          const before = get().users.find((u) => u.id === user.id)
          set((s) => ({ users: before ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, user] }))
          log({
            action: before ? "Updated user" : "Added user",
            entity: "user",
            entityId: user.id,
            entityLabel: user.name,
            before: before ? `${before.role}, ${before.active ? "active" : "inactive"}` : undefined,
            after: `${user.role}, ${user.active ? "active" : "inactive"}`,
          })
        },
      }
    },
    {
      name: "paygrade-data",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Version 1 held semi-monthly demo data. It cannot be converted, so start from the seed.
      migrate: () => ({}),
      skipHydration: true,
      partialize: (state) => {
        const frozen = seedReleasedLines()
        const data: DemoData = {
          users: state.users,
          departments: state.departments,
          employees: state.employees,
          positions: state.positions,
          salarySchedules: state.salarySchedules,
          ratesVersions: state.ratesVersions,
          allowanceTypes: state.allowanceTypes,
          signatories: state.signatories,
          periods: state.periods,
          dtr: state.dtr,
          leaveCredits: state.leaveCredits,
          loans: state.loans,
          runs: state.runs.map((r) => (frozen.has(r.id) && r.status === "released" ? { ...r, lines: [] } : r)),
          remittanceFilings: state.remittanceFilings,
          audit: state.audit,
        }
        return data
      },
      merge: (persisted, current) => {
        const data = persisted as Partial<DemoData> | undefined
        if (!data?.runs) return current
        const frozen = seedReleasedLines()
        const runs = data.runs.map((r) => (r.lines.length === 0 && frozen.has(r.id) ? { ...r, lines: frozen.get(r.id) ?? [] } : r))
        return { ...current, ...data, runs }
      },
    }
  )
)
