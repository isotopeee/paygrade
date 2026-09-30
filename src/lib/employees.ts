/**
 * Pure helpers for the Employees area: ID input formatting, employee number
 * generation, step increment schedule, and the add or edit form schema.
 */

import { addYears, differenceInCalendarDays, differenceInYears, format, parseISO } from "date-fns"
import { z } from "zod"

import type {
  CivilStatus,
  Employee,
  EmployeeStatus,
  EmploymentType,
  ISODate,
  RateType,
  Sex,
} from "@/types"
import { groupOf } from "@/lib/constants"
import { pesos } from "@/lib/payroll/money"

/* ------------------------------------------------------------------ */
/* Input formatting                                                    */
/* ------------------------------------------------------------------ */

function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max)
}

/** Insert separators after the given group sizes, for example [3, 3, 3, 5]. */
function groupDigits(value: string, groups: number[], separator: string): string {
  const max = groups.reduce((a, b) => a + b, 0)
  const digits = digitsOnly(value, max)
  const parts: string[] = []
  let index = 0
  for (const size of groups) {
    if (index >= digits.length) break
    parts.push(digits.slice(index, index + size))
    index += size
  }
  return parts.join(separator)
}

export const idFormatters = {
  /** 123-456-789-000 (branch code 3 to 5 digits). */
  tin: (v: string) => groupDigits(v, [3, 3, 3, 5], "-"),
  gsisBpNo: (v: string) => digitsOnly(v, 11),
  /** 12-345678901-2 */
  philhealthNo: (v: string) => groupDigits(v, [2, 9, 1], "-"),
  /** 1234-5678-9012 */
  pagibigMid: (v: string) => groupDigits(v, [4, 4, 4], "-"),
  /** 0917 123 4567 */
  mobile: (v: string) => groupDigits(v, [4, 3, 4], " "),
  /** Landbank account 1234-5678-90 */
  bankAccountNo: (v: string) => groupDigits(v, [4, 4, 2], "-"),
} as const

export type FormattedIdField = keyof typeof idFormatters

/** Mask an account number except its last four digits. */
export function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, "")
  if (digits.length <= 4) return account
  return `${"•".repeat(4)} ${"•".repeat(4)} ${digits.slice(-4)}`
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export function ageOn(birthDate: ISODate, date: ISODate): number {
  return differenceInYears(parseISO(date), parseISO(birthDate))
}

export function yearsOfService(dateHired: ISODate, date: ISODate): number {
  return Math.max(0, differenceInYears(parseISO(date), parseISO(dateHired)))
}

export interface StepIncrementInfo {
  maxed: boolean
  dueDate?: ISODate
  /** Days from `today` to the due date. Negative when overdue. */
  daysUntil?: number
  /** Due within 90 days or already overdue. */
  attention: boolean
}

/** Step increment every 3 years of continuous satisfactory service (step 8 is the maximum). */
export function stepIncrementInfo(
  employee: Pick<Employee, "step" | "lastStepIncrement" | "dateHired">,
  today: ISODate
): StepIncrementInfo {
  if ((employee.step ?? 1) >= 8) return { maxed: true, attention: false }
  const from = employee.lastStepIncrement ?? employee.dateHired
  const due = addYears(parseISO(from), 3)
  const dueDate = format(due, "yyyy-MM-dd")
  const daysUntil = differenceInCalendarDays(due, parseISO(today))
  return { maxed: false, dueDate, daysUntil, attention: daysUntil <= 90 }
}

/* ------------------------------------------------------------------ */
/* Employee numbers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Next employee number for a new hire. Plantilla: `YYYY-####` by hire year.
 * JO: `JO-YY-###`. COS: `COS-YY-###`.
 */
export function nextEmployeeNo(
  existing: readonly Pick<Employee, "employeeNo">[],
  type: EmploymentType,
  dateHired: ISODate
): string {
  const year = dateHired.slice(0, 4)
  const yy = year.slice(2)
  let prefix: string
  let width: number
  if (groupOf(type) === "plantilla") {
    prefix = `${year}-`
    width = 4
  } else {
    prefix = `${type === "job_order" ? "JO" : "COS"}-${yy}-`
    width = 3
  }
  const pattern = new RegExp(`^${prefix}(\\d{${width}})$`)
  let max = 0
  for (const e of existing) {
    const match = pattern.exec(e.employeeNo)
    if (match?.[1]) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`
}

export function rateTypeFor(type: EmploymentType): RateType {
  if (groupOf(type) === "plantilla") return "salary_grade"
  return type === "job_order" ? "daily" : "monthly"
}

/* ------------------------------------------------------------------ */
/* Form schema                                                         */
/* ------------------------------------------------------------------ */

const SEX = ["male", "female"] as const satisfies readonly Sex[]
const CIVIL = ["single", "married", "widowed", "separated"] as const satisfies readonly CivilStatus[]
const TYPES = [
  "permanent",
  "casual",
  "contractual",
  "job_order",
  "contract_of_service",
] as const satisfies readonly EmploymentType[]
const STATUSES = ["active", "on_leave", "suspended", "separated"] as const satisfies readonly EmployeeStatus[]

const RE = {
  tin: /^\d{3}-\d{3}-\d{3}-\d{3,5}$/,
  gsis: /^\d{11}$/,
  philhealth: /^\d{2}-\d{9}-\d$/,
  pagibig: /^\d{4}-\d{4}-\d{4}$/,
  mobile: /^09\d{2} \d{3} \d{4}$/,
  bank: /^\d{4}-\d{4}-\d{2}$/,
  pesos: /^\d{1,7}(\.\d{1,2})?$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
}

const required = (label: string) => z.string().trim().min(1, `${label} is required.`)

export const employeeFormSchema = z
  .object({
    firstName: required("First name"),
    middleName: z.string().trim(),
    lastName: required("Last name"),
    suffix: z.string().trim(),
    sex: z.enum(SEX, { error: "Select a sex." }),
    civilStatus: z.enum(CIVIL, { error: "Select a civil status." }),
    birthDate: z.string().regex(RE.date, "Enter the birth date."),
    address: required("Address"),
    mobile: z.string().regex(RE.mobile, "Use the format 09XX XXX XXXX."),
    email: z.email("Enter a valid email address."),

    tin: z.string().regex(RE.tin, "TIN must look like 123-456-789-000."),
    gsisBpNo: z.string().trim(),
    philhealthNo: z.string().regex(RE.philhealth, "PhilHealth No. must be 12 digits, for example 12-345678901-2."),
    pagibigMid: z.string().regex(RE.pagibig, "Pag-IBIG MID must be 12 digits, for example 1210-1234-5678."),
    bankAccountNo: z.string().regex(RE.bank, "Landbank account must be 10 digits, for example 1234-5678-90."),

    departmentId: required("Department"),
    positionTitle: required("Position title"),
    employmentType: z.enum(TYPES, { error: "Select an employment type." }),
    status: z.enum(STATUSES),
    dateHired: z.string().regex(RE.date, "Enter the date hired."),
    separationDate: z.string(),
    itemNo: z.string().trim(),
    salaryGrade: z.string(),
    step: z.string(),
    lastStepIncrement: z.string(),

    contractRate: z.string().trim(),
    contractEnd: z.string(),
    swornDeclaration: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message })
    const plantilla = groupOf(v.employmentType) === "plantilla"

    if (RE.date.test(v.birthDate) && RE.date.test(v.dateHired) && ageOn(v.birthDate, v.dateHired) < 18) {
      issue("birthDate", "Employee must be at least 18 years old on the date hired.")
    }

    if (plantilla) {
      if (!v.gsisBpNo) issue("gsisBpNo", "GSIS BP No. is required for plantilla personnel.")
      else if (!RE.gsis.test(v.gsisBpNo)) issue("gsisBpNo", "GSIS BP No. must be exactly 11 digits.")

      const sg = Number(v.salaryGrade)
      if (!v.salaryGrade || !Number.isInteger(sg) || sg < 1 || sg > 33) {
        issue("salaryGrade", "Salary grade must be from 1 to 33.")
      }
      const step = Number(v.step)
      if (!v.step || !Number.isInteger(step) || step < 1 || step > 8) {
        issue("step", "Step must be from 1 to 8.")
      }
      if (v.employmentType === "permanent" && !v.itemNo) {
        issue("itemNo", "Plantilla item number is required for permanent appointments.")
      }
      if (v.lastStepIncrement && v.lastStepIncrement < v.dateHired) {
        issue("lastStepIncrement", "Last step increment cannot be before the date hired.")
      }
    } else {
      if (v.gsisBpNo) issue("gsisBpNo", "Job Order and Contract of Service workers are not GSIS members. Leave this blank.")
      const label = v.employmentType === "job_order" ? "Daily rate" : "Monthly rate"
      if (!RE.pesos.test(v.contractRate) || Number(v.contractRate) <= 0) {
        issue("contractRate", `${label} must be a peso amount greater than zero.`)
      }
      if (!RE.date.test(v.contractEnd)) issue("contractEnd", "Enter the contract end date.")
      else if (v.contractEnd <= v.dateHired) issue("contractEnd", "Contract end must be after the date hired.")
    }

    if (v.status === "separated") {
      if (!RE.date.test(v.separationDate)) issue("separationDate", "Enter the separation date.")
      else if (v.separationDate < v.dateHired) issue("separationDate", "Separation date cannot be before the date hired.")
    }
  })

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export function emptyEmployeeForm(departmentId = ""): EmployeeFormValues {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    sex: "female",
    civilStatus: "single",
    birthDate: "",
    address: "",
    mobile: "",
    email: "",
    tin: "",
    gsisBpNo: "",
    philhealthNo: "",
    pagibigMid: "",
    bankAccountNo: "",
    departmentId,
    positionTitle: "",
    employmentType: "permanent",
    status: "active",
    dateHired: "",
    separationDate: "",
    itemNo: "",
    salaryGrade: "",
    step: "1",
    lastStepIncrement: "",
    contractRate: "",
    contractEnd: "",
    swornDeclaration: false,
  }
}

export function employeeToForm(e: Employee): EmployeeFormValues {
  return {
    firstName: e.firstName,
    middleName: e.middleName,
    lastName: e.lastName,
    suffix: e.suffix ?? "",
    sex: e.sex,
    civilStatus: e.civilStatus,
    birthDate: e.birthDate,
    address: e.address,
    mobile: e.mobile,
    email: e.email,
    tin: e.tin,
    gsisBpNo: e.gsisBpNo ?? "",
    philhealthNo: e.philhealthNo,
    pagibigMid: e.pagibigMid,
    bankAccountNo: e.bankAccountNo,
    departmentId: e.departmentId,
    positionTitle: e.positionTitle,
    employmentType: e.employmentType,
    status: e.status,
    dateHired: e.dateHired,
    separationDate: e.separationDate ?? "",
    itemNo: e.itemNo ?? "",
    salaryGrade: e.salaryGrade !== undefined ? String(e.salaryGrade) : "",
    step: e.step !== undefined ? String(e.step) : "",
    lastStepIncrement: e.lastStepIncrement ?? "",
    contractRate: e.contractRate !== undefined ? (e.contractRate / 100).toFixed(2) : "",
    contractEnd: e.contractEnd ?? "",
    swornDeclaration: e.swornDeclaration ?? false,
  }
}

const opt = (v: string): string | undefined => (v.trim() ? v.trim() : undefined)

/**
 * Employee fields derived from validated form values. Fields that do not apply
 * to the employment type are set to undefined.
 */
export function formToEmployeeFields(
  v: EmployeeFormValues
): Omit<Employee, "id" | "employeeNo" | "allowances" | "documents"> {
  const plantilla = groupOf(v.employmentType) === "plantilla"
  return {
    firstName: v.firstName.trim(),
    middleName: v.middleName.trim(),
    lastName: v.lastName.trim(),
    suffix: opt(v.suffix),
    sex: v.sex,
    civilStatus: v.civilStatus,
    birthDate: v.birthDate,
    address: v.address.trim(),
    mobile: v.mobile,
    email: v.email.trim().toLowerCase(),
    tin: v.tin,
    gsisBpNo: plantilla ? v.gsisBpNo : undefined,
    philhealthNo: v.philhealthNo,
    pagibigMid: v.pagibigMid,
    departmentId: v.departmentId,
    positionTitle: v.positionTitle.trim(),
    employmentType: v.employmentType,
    status: v.status,
    dateHired: v.dateHired,
    separationDate: v.status === "separated" ? opt(v.separationDate) : undefined,
    itemNo: plantilla ? opt(v.itemNo) : undefined,
    salaryGrade: plantilla ? Number(v.salaryGrade) : undefined,
    step: plantilla ? Number(v.step) : undefined,
    lastStepIncrement: plantilla ? opt(v.lastStepIncrement) : undefined,
    rateType: rateTypeFor(v.employmentType),
    contractRate: plantilla ? undefined : pesos(v.contractRate),
    contractEnd: plantilla ? undefined : opt(v.contractEnd),
    isHealthWorker: plantilla,
    swornDeclaration: plantilla ? undefined : v.swornDeclaration,
    bankAccountNo: v.bankAccountNo,
  }
}

/** Only the keys whose values differ from the current employee record. */
export function changedFields(current: Employee, next: Partial<Employee>): Partial<Employee> {
  const patch: Partial<Employee> = {}
  for (const key of Object.keys(next) as (keyof Employee)[]) {
    if (JSON.stringify(current[key]) !== JSON.stringify(next[key])) {
      Object.assign(patch, { [key]: next[key] })
    }
  }
  return patch
}
