/**
 * Deterministic demo data for PayGrade. Every call to `createSeed()` returns the
 * same dataset: a seeded Faker instance drives all randomness.
 *
 * Reference date for the demo is Sep 22, 2026. History covers Oct 2025 to
 * Sep 1 to 15, 2026. The current plantilla run (Sep 16 to 30, 2026) is in Draft.
 */

import { Faker, base } from "@faker-js/faker"
import { addDays, addMonths, addYears, format, parseISO, subDays } from "date-fns"

import type {
  AllowanceType,
  AppUser,
  AuditEntry,
  Department,
  DtrSummary,
  Employee,
  EmployeeAllowance,
  EmployeeDocument,
  EmployeeGroup,
  EmploymentType,
  LeaveCredit,
  Loan,
  LoanType,
  PayrollPeriod,
  PayrollRun,
  Position,
  RatesConfig,
  RemittanceFiling,
  RunComment,
  RunStatus,
  RunTransition,
  SalarySchedule,
  Signatory,
  SpecialPayrollKind,
} from "@/types"
import { GROUP_LABELS, RUN_STATUS_ORDER, SPECIAL_KIND_LABELS } from "@/lib/constants"
import { formatPeriod, fullName } from "@/lib/format"
import { buildPeriods, toISODate, yearsBetween } from "@/lib/payroll/calendar"
import { daysRequiredInPeriod } from "@/lib/payroll/compute"
import {
  computeRegularLines,
  computeSpecialLines,
  employeesForPeriod,
  monthRange,
  specialEligibility,
  type EngineData,
} from "@/lib/payroll/engine"
import { pesos } from "@/lib/payroll/money"
import { SEED_ALLOWANCE_TYPES, SEED_RATES } from "@/lib/payroll/rates"
import { EMPTY_TOTALS, computeRunTotals } from "@/lib/payroll/totals"

import { BARANGAYS, FEMALE_FIRST_NAMES, MALE_FIRST_NAMES, SURNAMES, TOWNS } from "./names"
import { SEED_DEPARTMENTS, SEED_SIGNATORIES, SEED_USERS, userForRole } from "./reference"
import { SEED_SALARY_SCHEDULES } from "./salary-schedule"

export const DEMO_TODAY = "2026-09-22"
export const CURRENT_PERIOD_ID = "P202609"

export interface DemoData {
  users: AppUser[]
  departments: Department[]
  employees: Employee[]
  positions: Position[]
  salarySchedules: SalarySchedule[]
  ratesVersions: RatesConfig[]
  allowanceTypes: AllowanceType[]
  signatories: Signatory[]
  periods: PayrollPeriod[]
  dtr: DtrSummary[]
  leaveCredits: LeaveCredit[]
  loans: Loan[]
  runs: PayrollRun[]
  remittanceFilings: Record<string, RemittanceFiling>
  audit: AuditEntry[]
}

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

interface FixedPerson {
  first: string
  middle: string
  last: string
  sex: "male" | "female"
  hired: string
}

interface RosterEntry {
  dept: string
  title: string
  sg?: number
  type: EmploymentType
  count: number
  /** Daily rate (JO) or monthly rate (COS) in pesos, as a range. */
  rate?: [number, number]
  shift?: boolean
  code: string
  person?: FixedPerson
  rata?: number
}

const PLANTILLA_ROSTER: RosterEntry[] = [
  // Psychiatry
  { dept: "dept-psychiatry", title: "Medical Specialist II", sg: 23, type: "permanent", count: 1, code: "MS2",
    person: { first: "Rafael", middle: "Salvador", last: "Navarro", sex: "male", hired: "2009-03-02" } },
  { dept: "dept-psychiatry", title: "Medical Officer III", sg: 21, type: "permanent", count: 1, code: "MO3", shift: true },
  { dept: "dept-psychiatry", title: "Psychologist II", sg: 15, type: "permanent", count: 1, code: "PSY2" },
  { dept: "dept-psychiatry", title: "Social Welfare Officer II", sg: 15, type: "permanent", count: 1, code: "SWO2" },
  { dept: "dept-psychiatry", title: "Occupational Therapist I", sg: 11, type: "permanent", count: 1, code: "OT1" },
  // Medical
  { dept: "dept-medical", title: "Chief of Hospital II", sg: 26, type: "permanent", count: 1, code: "COH2", rata: 7_500,
    person: { first: "Elena", middle: "Ramos", last: "Bautista", sex: "female", hired: "2001-07-16" } },
  { dept: "dept-medical", title: "Chief of Medical Professional Staff I", sg: 25, type: "permanent", count: 1, code: "CMPS1", rata: 5_000 },
  { dept: "dept-medical", title: "Medical Officer IV", sg: 23, type: "permanent", count: 1, code: "MO4", shift: true },
  { dept: "dept-medical", title: "Medical Officer III", sg: 21, type: "permanent", count: 1, code: "MO3", shift: true },
  { dept: "dept-medical", title: "Medical Officer III", sg: 21, type: "contractual", count: 1, code: "MO3", shift: true },
  // Nursing
  { dept: "dept-nursing", title: "Nurse VI (Chief Nurse)", sg: 22, type: "permanent", count: 1, code: "NURS6", rata: 5_000,
    person: { first: "Rosario", middle: "Tan", last: "Magbanua", sex: "female", hired: "1998-02-02" } },
  { dept: "dept-nursing", title: "Nurse III", sg: 17, type: "permanent", count: 2, code: "NURS3", shift: true },
  { dept: "dept-nursing", title: "Nurse II", sg: 16, type: "permanent", count: 3, code: "NURS2", shift: true },
  { dept: "dept-nursing", title: "Nurse I", sg: 15, type: "permanent", count: 5, code: "NURS1", shift: true },
  { dept: "dept-nursing", title: "Nursing Attendant II", sg: 6, type: "permanent", count: 2, code: "NA2", shift: true },
  { dept: "dept-nursing", title: "Nursing Attendant I", sg: 4, type: "casual", count: 2, code: "NA1", shift: true },
  // Laboratory
  { dept: "dept-laboratory", title: "Medical Technologist II", sg: 15, type: "permanent", count: 1, code: "MT2",
    person: { first: "Kristine", middle: "Abad", last: "Lacson", sex: "female", hired: "2012-10-01" } },
  { dept: "dept-laboratory", title: "Medical Technologist I", sg: 11, type: "permanent", count: 2, code: "MT1", shift: true },
  // Pharmacy
  { dept: "dept-pharmacy", title: "Pharmacist II", sg: 15, type: "permanent", count: 1, code: "PHAR2",
    person: { first: "Jerome", middle: "Pascual", last: "Tolentino", sex: "male", hired: "2014-04-21" } },
  { dept: "dept-pharmacy", title: "Pharmacist I", sg: 11, type: "permanent", count: 1, code: "PHAR1" },
  // Radiology
  { dept: "dept-radiology", title: "Radiologic Technologist II", sg: 13, type: "permanent", count: 1, code: "RT2",
    person: { first: "Paolo", middle: "Manalo", last: "Sarmiento", sex: "male", hired: "2016-08-01" } },
  { dept: "dept-radiology", title: "Radiologic Technologist I", sg: 11, type: "permanent", count: 1, code: "RT1", shift: true },
  // Dietary
  { dept: "dept-dietary", title: "Nutritionist-Dietitian II", sg: 13, type: "permanent", count: 1, code: "ND2",
    person: { first: "Liza", middle: "Galang", last: "Soriano", sex: "female", hired: "2011-01-17" } },
  { dept: "dept-dietary", title: "Cook II", sg: 4, type: "casual", count: 1, code: "COOK2" },
  // Administrative
  { dept: "dept-administrative", title: "Chief Administrative Officer", sg: 24, type: "permanent", count: 1, code: "CADOF", rata: 5_000,
    person: { first: "Antonio", middle: "Villar", last: "Pascual", sex: "male", hired: "2003-05-05" } },
  { dept: "dept-administrative", title: "Administrative Officer IV", sg: 15, type: "permanent", count: 1, code: "AO4" },
  { dept: "dept-administrative", title: "Administrative Assistant II", sg: 8, type: "permanent", count: 1, code: "ADAS2" },
  { dept: "dept-administrative", title: "Information Technology Officer I", sg: 19, type: "permanent", count: 1, code: "ITO1",
    person: { first: "Carlo", middle: "Macaraeg", last: "Reyes", sex: "male", hired: "2018-02-12" } },
  { dept: "dept-administrative", title: "Records Officer II", sg: 14, type: "permanent", count: 1, code: "RO2" },
  // Finance
  { dept: "dept-finance", title: "Accountant III", sg: 19, type: "permanent", count: 1, code: "ACCT3",
    person: { first: "Ramon", middle: "Panganiban", last: "Villanueva", sex: "male", hired: "2008-09-15" } },
  { dept: "dept-finance", title: "Accountant II", sg: 16, type: "permanent", count: 1, code: "ACCT2",
    person: { first: "Nerissa", middle: "Balagtas", last: "Dizon", sex: "female", hired: "2019-06-03" } },
  { dept: "dept-finance", title: "Cashier II", sg: 15, type: "permanent", count: 1, code: "CASH2",
    person: { first: "Josefina", middle: "Legaspi", last: "Mercado", sex: "female", hired: "2006-11-06" } },
  { dept: "dept-finance", title: "Budget Officer II", sg: 15, type: "permanent", count: 1, code: "BO2" },
  // HR
  { dept: "dept-hr", title: "Human Resource Management Officer III", sg: 18, type: "permanent", count: 1, code: "HRMO3",
    person: { first: "Maricel", middle: "Dizon", last: "Santos", sex: "female", hired: "2010-03-01" } },
  { dept: "dept-hr", title: "Human Resource Management Officer II", sg: 15, type: "permanent", count: 1, code: "HRMO2",
    person: { first: "Angelica", middle: "Francisco", last: "Ocampo", sex: "female", hired: "2020-01-06" } },
  { dept: "dept-hr", title: "Human Resource Management Assistant", sg: 8, type: "permanent", count: 1, code: "HRMA" },
  // Security
  { dept: "dept-security", title: "Security Guard II", sg: 5, type: "permanent", count: 1, code: "SG2", shift: true,
    person: { first: "Rolando", middle: "Buenaventura", last: "Castro", sex: "male", hired: "2005-07-01" } },
  // Housekeeping
  { dept: "dept-housekeeping", title: "Administrative Aide III (Utility Worker II)", sg: 3, type: "casual", count: 1, code: "ADA3",
    person: { first: "Divina", middle: "Cabrera", last: "Ramos", sex: "female", hired: "2013-03-18" } },
  // Engineering and Maintenance
  { dept: "dept-engineering", title: "Engineer II", sg: 16, type: "permanent", count: 1, code: "ENGR2",
    person: { first: "Edgardo", middle: "Lim", last: "Valdez", sex: "male", hired: "2007-10-08" } },
  { dept: "dept-engineering", title: "Electrician II", sg: 6, type: "permanent", count: 1, code: "ELEC2" },
]

const JO_COS_ROSTER: RosterEntry[] = [
  { dept: "dept-security", title: "Security Guard (JO)", type: "job_order", count: 5, rate: [610, 645], shift: true, code: "JO" },
  { dept: "dept-housekeeping", title: "Utility Worker (JO)", type: "job_order", count: 6, rate: [540, 585], code: "JO" },
  { dept: "dept-housekeeping", title: "Laundry Worker (JO)", type: "job_order", count: 1, rate: [540, 560], code: "JO" },
  { dept: "dept-dietary", title: "Food Service Worker (JO)", type: "job_order", count: 2, rate: [560, 590], code: "JO" },
  { dept: "dept-nursing", title: "Nurse (COS)", type: "contract_of_service", count: 4, rate: [36_000, 38_500], shift: true, code: "COS" },
  { dept: "dept-nursing", title: "Nursing Aide (JO)", type: "job_order", count: 2, rate: [600, 640], shift: true, code: "JO" },
  { dept: "dept-laboratory", title: "Medical Technologist (COS)", type: "contract_of_service", count: 1, rate: [30_000, 31_000], code: "COS" },
  { dept: "dept-administrative", title: "Administrative Aide, Encoder (JO)", type: "job_order", count: 2, rate: [575, 610], code: "JO" },
  { dept: "dept-administrative", title: "IT Support Staff (COS)", type: "contract_of_service", count: 1, rate: [25_000, 26_000], code: "COS" },
  { dept: "dept-engineering", title: "Maintenance Worker (JO)", type: "job_order", count: 2, rate: [575, 600], code: "JO" },
  { dept: "dept-engineering", title: "Driver (JO)", type: "job_order", count: 1, rate: [600, 620], code: "JO" },
  { dept: "dept-psychiatry", title: "Psychometrician (COS)", type: "contract_of_service", count: 1, rate: [25_000, 27_000], code: "COS" },
  { dept: "dept-pharmacy", title: "Pharmacy Aide (JO)", type: "job_order", count: 1, rate: [560, 580], code: "JO" },
  { dept: "dept-finance", title: "Bookkeeper (COS)", type: "contract_of_service", count: 1, rate: [22_000, 23_000], code: "COS" },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function digits(f: Faker, n: number): string {
  return f.string.numeric({ length: n, allowLeadingZeros: true })
}

function iso(date: Date): string {
  return toISODate(date)
}

function at(date: string, time: string): string {
  return `${date}T${time}:00.000+08:00`
}

/* ------------------------------------------------------------------ */
/* Employees and positions                                             */
/* ------------------------------------------------------------------ */

interface GeneratedEmployee {
  employee: Employee
  shift: boolean
}

function buildEmployees(f: Faker): GeneratedEmployee[] {
  const used = new Set<string>()
  const result: GeneratedEmployee[] = []
  const seqByYear = new Map<string, number>()
  let itemSeq = 100

  function uniqueName(sex: "male" | "female") {
    for (;;) {
      const first = f.helpers.arrayElement(sex === "female" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES)
      const last = f.helpers.arrayElement(SURNAMES)
      const middle = f.helpers.arrayElement(SURNAMES.filter((s) => s !== last))
      const key = `${first} ${last}`
      if (!used.has(key)) {
        used.add(key)
        return { first, middle, last }
      }
    }
  }

  function makeOne(entry: RosterEntry, index: number): GeneratedEmployee {
    const group: EmployeeGroup = entry.type === "job_order" || entry.type === "contract_of_service" ? "jo_cos" : "plantilla"
    const sex = entry.person?.sex ?? (f.number.int({ min: 0, max: 99 }) < 58 ? "female" : "male")
    const name = entry.person
      ? { first: entry.person.first, middle: entry.person.middle, last: entry.person.last }
      : uniqueName(sex)
    if (entry.person) used.add(`${name.first} ${name.last}`)

    const hired =
      entry.person?.hired ??
      (group === "plantilla"
        ? iso(f.date.between({ from: "1997-01-01", to: "2025-06-30" }))
        : iso(f.date.between({ from: "2021-01-01", to: "2026-01-31" })))
    const hireYear = hired.slice(0, 4)
    const seq = (seqByYear.get(hireYear) ?? 0) + 1
    seqByYear.set(hireYear, seq)
    const employeeNo =
      group === "plantilla"
        ? `${hireYear}-${String(seq).padStart(4, "0")}`
        : `${entry.code}-${hireYear.slice(2)}-${String(seq).padStart(3, "0")}`

    const age = f.number.int({ min: 22, max: 30 })
    const birthDate = iso(subDays(addYears(parseISO(hired), -age), f.number.int({ min: 0, max: 360 })))
    const years = yearsBetween(hired, DEMO_TODAY)
    const step = group === "plantilla" ? Math.min(8, 1 + Math.floor(years / 3)) : undefined
    const lastStepIncrement =
      step && step > 1 ? iso(addYears(parseISO(hired), (step - 1) * 3)) : undefined

    const itemNo =
      entry.type === "permanent"
        ? `MMWGH-${entry.code}-${String(++itemSeq).padStart(6, "0")}-${hireYear}`
        : undefined

    const allowances: EmployeeAllowance[] = entry.rata
      ? [
          { allowanceTypeId: "alw-ra", amount: pesos(entry.rata) },
          { allowanceTypeId: "alw-ta", amount: pesos(entry.rata) },
        ]
      : []

    const rateType = group === "plantilla" ? "salary_grade" : entry.type === "job_order" ? "daily" : "monthly"
    const contractRate = entry.rate
      ? pesos(
          entry.type === "job_order"
            ? f.number.int({ min: entry.rate[0], max: entry.rate[1] })
            : f.number.int({ min: entry.rate[0] / 100, max: entry.rate[1] / 100 }) * 100
        )
      : undefined

    const documents: EmployeeDocument[] =
      group === "plantilla"
        ? [
            { id: `doc-${index}-1`, name: "Appointment (CS Form No. 33-A)", kind: "appointment", uploadedAt: hired, sizeKb: f.number.int({ min: 180, max: 420 }) },
            { id: `doc-${index}-2`, name: "Oath of Office", kind: "oath", uploadedAt: hired, sizeKb: f.number.int({ min: 90, max: 200 }) },
            { id: `doc-${index}-3`, name: "Personal Data Sheet (CS Form 212)", kind: "pds", uploadedAt: "2026-01-20", sizeKb: f.number.int({ min: 300, max: 900 }) },
            { id: `doc-${index}-4`, name: "SALN CY 2025", kind: "saln", uploadedAt: "2026-04-28", sizeKb: f.number.int({ min: 250, max: 600 }) },
          ]
        : [
            { id: `doc-${index}-1`, name: "Contract of Service, CY 2026", kind: "contract", uploadedAt: "2026-01-05", sizeKb: f.number.int({ min: 150, max: 350 }) },
            { id: `doc-${index}-2`, name: "Personal Data Sheet (CS Form 212)", kind: "pds", uploadedAt: hired, sizeKb: f.number.int({ min: 300, max: 900 }) },
          ]

    const town = f.helpers.arrayElement(TOWNS)
    const barangay = town === "Mariveles" ? f.helpers.arrayElement(BARANGAYS) : "Poblacion"
    const emailLocal = `${name.first}.${name.last}`.toLowerCase().replace(/[^a-z.]/g, "")

    const employee: Employee = {
      id: `emp-${String(index + 1).padStart(3, "0")}`,
      employeeNo,
      firstName: name.first,
      middleName: name.middle,
      lastName: name.last,
      sex,
      civilStatus: f.helpers.weightedArrayElement([
        { weight: 5, value: "married" as const },
        { weight: 4, value: "single" as const },
        { weight: 1, value: "widowed" as const },
      ]),
      birthDate,
      address: `Purok ${f.number.int({ min: 1, max: 7 })}, Brgy. ${barangay}, ${town}, Bataan`,
      mobile: `09${f.helpers.arrayElement(["17", "18", "19", "20", "27", "39", "55", "66", "95"])} ${digits(f, 3)} ${digits(f, 4)}`,
      email: `${emailLocal}@mmwgh.doh.gov.ph`,
      tin: `${digits(f, 3)}-${digits(f, 3)}-${digits(f, 3)}-000`,
      gsisBpNo: group === "plantilla" ? digits(f, 11) : undefined,
      philhealthNo: `${digits(f, 2)}-${digits(f, 9)}-${digits(f, 1)}`,
      pagibigMid: `${f.helpers.arrayElement(["1210", "1211", "1212"])}-${digits(f, 4)}-${digits(f, 4)}`,
      departmentId: entry.dept,
      positionTitle: entry.title,
      employmentType: entry.type,
      status: "active",
      dateHired: hired,
      itemNo,
      salaryGrade: entry.sg,
      step,
      lastStepIncrement,
      rateType,
      contractRate,
      contractEnd: group === "jo_cos" ? "2026-12-31" : undefined,
      isHealthWorker: group === "plantilla",
      swornDeclaration: group === "jo_cos" ? f.number.int({ min: 0, max: 9 }) < 7 : undefined,
      bankAccountNo: `${digits(f, 4)}-${digits(f, 4)}-${digits(f, 2)}`,
      allowances,
      documents,
    }
    return { employee, shift: entry.shift ?? false }
  }

  let index = 0
  for (const entry of [...PLANTILLA_ROSTER, ...JO_COS_ROSTER]) {
    for (let i = 0; i < entry.count; i++) {
      result.push(makeOne(entry, index++))
    }
  }

  // Scenario employees for exceptions and history
  const nurses = result.filter((r) => r.employee.positionTitle === "Nurse I")
  const newHire = nurses[nurses.length - 1]
  if (newHire) {
    newHire.employee.dateHired = "2026-09-21"
    newHire.employee.step = 1
    newHire.employee.lastStepIncrement = undefined
    newHire.employee.employeeNo = "2026-0101"
    newHire.employee.documents = newHire.employee.documents.slice(0, 3)
  }
  const retiree = result.find((r) => r.employee.positionTitle === "Nurse III")
  if (retiree) {
    retiree.employee.dateHired = "1994-06-01"
    retiree.employee.employeeNo = "1994-0001"
    retiree.employee.birthDate = "1961-09-25"
    retiree.employee.step = 8
    retiree.employee.separationDate = "2026-09-25"
    retiree.employee.status = "separated"
  }
  const resigned = result.find((r) => r.employee.positionTitle === "Administrative Assistant II")
  if (resigned) {
    resigned.employee.separationDate = "2026-03-31"
    resigned.employee.status = "separated"
  }
  const onLeave = result.filter((r) => r.employee.positionTitle === "Nurse II" && r.employee.sex === "female")[0]
    ?? result.find((r) => r.employee.positionTitle === "Nurse II")
  if (onLeave) onLeave.employee.status = "on_leave"
  const joNewHire = result.find((r) => r.employee.positionTitle === "Utility Worker (JO)")
  if (joNewHire) {
    joNewHire.employee.dateHired = "2026-09-07"
    joNewHire.employee.employeeNo = "JO-26-041"
  }

  return result
}

function buildPositions(employees: Employee[], f: Faker): Position[] {
  const positions: Position[] = employees
    .filter((e) => e.itemNo)
    .map((e, i) => ({
      id: `pos-${String(i + 1).padStart(3, "0")}`,
      itemNo: e.itemNo ?? "",
      title: e.positionTitle,
      salaryGrade: e.salaryGrade ?? 1,
      departmentId: e.departmentId,
      employeeId: e.status === "separated" && (e.separationDate ?? "") < DEMO_TODAY ? undefined : e.id,
      dateCreated: e.dateHired < "2000-01-01" ? "1998-01-01" : `${e.dateHired.slice(0, 4)}-01-01`,
      authorization: "DBM Notice of Organization, Staffing, and Compensation Action",
    }))

  const vacancies: { title: string; sg: number; dept: string; code: string }[] = [
    { title: "Nurse I", sg: 15, dept: "dept-nursing", code: "NURS1" },
    { title: "Nurse I", sg: 15, dept: "dept-nursing", code: "NURS1" },
    { title: "Nurse I", sg: 15, dept: "dept-nursing", code: "NURS1" },
    { title: "Medical Officer III", sg: 21, dept: "dept-psychiatry", code: "MO3" },
    { title: "Psychologist I", sg: 11, dept: "dept-psychiatry", code: "PSY1" },
    { title: "Pharmacist I", sg: 11, dept: "dept-pharmacy", code: "PHAR1" },
    { title: "Security Guard I", sg: 3, dept: "dept-security", code: "SG1" },
    { title: "Administrative Aide I", sg: 1, dept: "dept-housekeeping", code: "ADA1" },
  ]
  vacancies.forEach((v, i) => {
    const year = f.helpers.arrayElement(["2019", "2021", "2023", "2025"])
    positions.push({
      id: `pos-v${i + 1}`,
      itemNo: `MMWGH-${v.code}-${String(300 + i).padStart(6, "0")}-${year}`,
      title: v.title,
      salaryGrade: v.sg,
      departmentId: v.dept,
      dateCreated: `${year}-01-01`,
      authorization: "DBM Notice of Organization, Staffing, and Compensation Action",
    })
  })
  return positions
}

/* ------------------------------------------------------------------ */
/* Attendance, leave, loans                                            */
/* ------------------------------------------------------------------ */

const MISSING_DTR_CURRENT = new Set(["Records Officer II", "Driver (JO)", "Electrician II"])

function buildDtr(f: Faker, generated: GeneratedEmployee[], periods: PayrollPeriod[]): DtrSummary[] {
  const records: DtrSummary[] = []
  for (const period of periods) {
    if (period.start > "2026-09-01") continue
    for (const { employee, shift } of generated) {
      if (employee.dateHired > period.end) continue
      if (employee.separationDate && employee.separationDate < period.start) continue
      if (period.id === CURRENT_PERIOD_ID && MISSING_DTR_CURRENT.has(employee.positionTitle)) continue

      const group = employee.rateType === "salary_grade" ? "plantilla" : "jo_cos"
      const daysRequired = daysRequiredInPeriod(employee, period)
      const onLeave = employee.status === "on_leave" && period.start >= "2026-08-01"
      let absences = 0
      let leave = 0
      if (onLeave) {
        leave = daysRequired
      } else {
        absences =
          f.number.int({ min: 0, max: 99 }) < (group === "plantilla" ? 15 : 30)
            ? f.number.int({ min: 1, max: group === "plantilla" ? 2 : 4 })
            : 0
        leave = group === "plantilla" && f.number.int({ min: 0, max: 99 }) < 40 ? f.number.int({ min: 1, max: 4 }) : 0
      }
      absences = Math.min(absences, daysRequired)
      leave = Math.min(leave, daysRequired - absences)
      const worked = daysRequired - absences - leave
      const late = !onLeave && f.number.int({ min: 0, max: 99 }) < 55 ? f.number.int({ min: 3, max: 160 }) : 0
      const under = !onLeave && f.number.int({ min: 0, max: 99 }) < 25 ? f.number.int({ min: 10, max: 120 }) : 0
      const otRegular = shift && !onLeave && f.number.int({ min: 0, max: 99 }) < 35 ? f.helpers.arrayElement([4, 8, 8, 12, 16]) : 0
      const otRest = shift && !onLeave && f.number.int({ min: 0, max: 99 }) < 20 ? f.helpers.arrayElement([8, 16]) : 0
      const nd = shift && !onLeave ? f.helpers.arrayElement([0, 32, 48, 64, 80]) : 0

      records.push({
        employeeId: employee.id,
        periodId: period.id,
        daysRequired,
        daysWorked: worked,
        leaveWithPayDays: leave,
        absencesWithoutPay: absences,
        tardinessMinutes: late,
        undertimeMinutes: under,
        overtimeHoursRegular: otRegular,
        overtimeHoursRestDay: otRest,
        nightDiffHours: Math.min(nd, worked * 8),
        source: "biometric",
      })
    }
  }
  return records
}

function buildLeaveCredits(f: Faker, employees: Employee[]): LeaveCredit[] {
  return employees
    .filter((e) => e.rateType === "salary_grade")
    .map((e) => {
      const years = Math.max(0, yearsBetween(e.dateHired, DEMO_TODAY))
      const cap = Math.min(15 * years + 12, 300)
      return {
        employeeId: e.id,
        vacationLeave: Math.round(f.number.float({ min: Math.min(3, cap), max: Math.max(3, cap * 0.55) }) * 1000) / 1000,
        sickLeave: Math.round(f.number.float({ min: Math.min(4, cap), max: Math.max(4, cap * 0.7) }) * 1000) / 1000,
        specialPrivilegeLeave: f.number.int({ min: 0, max: 3 }),
        forcedLeave: f.helpers.arrayElement([0, 1, 2, 3, 5]),
        asOf: "2026-08-31",
      }
    })
}

const LOAN_SPECS: { type: LoanType; principal: [number, number]; term: number[]; rate: number; prefix: string; plantillaOnly: boolean }[] = [
  { type: "gsis_consoloan", principal: [150_000, 900_000], term: [48, 60, 72], rate: 0.06, prefix: "CL", plantillaOnly: true },
  { type: "gsis_emergency", principal: [20_000, 40_000], term: [36], rate: 0.06, prefix: "EL", plantillaOnly: true },
  { type: "gsis_policy", principal: [30_000, 120_000], term: [24, 36], rate: 0.08, prefix: "PL", plantillaOnly: true },
  { type: "gsis_mpl", principal: [50_000, 300_000], term: [36, 48], rate: 0.07, prefix: "MPL", plantillaOnly: true },
  { type: "pagibig_mpl", principal: [20_000, 120_000], term: [24, 36], rate: 0.105, prefix: "HMPL", plantillaOnly: false },
  { type: "pagibig_calamity", principal: [10_000, 40_000], term: [24, 36], rate: 0.0595, prefix: "HCL", plantillaOnly: false },
  { type: "cooperative", principal: [10_000, 60_000], term: [12, 18, 24], rate: 0.12, prefix: "COOP", plantillaOnly: false },
  { type: "landbank", principal: [50_000, 250_000], term: [24, 36], rate: 0.09, prefix: "LBP", plantillaOnly: true },
]

function buildLoans(f: Faker, employees: Employee[]): Loan[] {
  const loans: Loan[] = []
  let seq = 1
  for (const e of employees) {
    if (e.status === "separated" && (e.separationDate ?? "") < "2026-06-01") continue
    if (e.dateHired > "2026-01-01") continue
    const plantilla = e.rateType === "salary_grade"
    const count = plantilla
      ? f.helpers.weightedArrayElement([
          { weight: 2, value: 0 },
          { weight: 4, value: 1 },
          { weight: 3, value: 2 },
          { weight: 1, value: 3 },
        ])
      : f.helpers.weightedArrayElement([
          { weight: 6, value: 0 },
          { weight: 3, value: 1 },
        ])
    const specs = f.helpers.arrayElements(
      LOAN_SPECS.filter((s) => plantilla || !s.plantillaOnly),
      count
    )
    for (const spec of specs) {
      const principal = f.number.int({ min: spec.principal[0] / 1000, max: spec.principal[1] / 1000 }) * 1000
      const term = f.helpers.arrayElement(spec.term)
      const total = Math.round(principal * (1 + spec.rate * (term / 12)))
      const monthly = Math.round((total / term) * 100) / 100
      // Start between 40 months ago and 1 month ago
      const startMonth = addMonths(parseISO("2026-09-01"), -f.number.int({ min: 1, max: Math.min(term + 6, 40) }))
      const start = iso(startMonth)
      const end = iso(subDays(addMonths(startMonth, term), 1))
      const monthsPaid = Math.max(
        0,
        Math.min(term, (2026 - startMonth.getFullYear()) * 12 + (8 - startMonth.getMonth()) + 1)
      )
      const paid = pesos(monthly) * monthsPaid
      const status = end < DEMO_TODAY ? "fully_paid" : "active"
      loans.push({
        id: `loan-${String(seq).padStart(3, "0")}`,
        employeeId: e.id,
        type: spec.type,
        referenceNo: `${spec.prefix}-${start.slice(0, 4)}-${digits(f, 6)}`,
        principal: pesos(principal),
        monthlyAmortization: pesos(monthly),
        totalPayable: pesos(monthly) * term,
        startPeriod: start,
        endPeriod: end,
        termMonths: term,
        paidToDate: status === "fully_paid" ? pesos(monthly) * term : paid,
        status,
      })
      seq++
    }
  }
  // One suspended cooperative loan for the ledger demo
  const coop = loans.find((l) => l.type === "cooperative" && l.status === "active")
  if (coop) coop.status = "suspended"
  return loans
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

const HR = userForRole("hr")
const ACCT = userForRole("accountant")
const CHIEF = userForRole("chief")
const CASHIER = userForRole("cashier")

const ACTORS: Record<RunStatus, AppUser> = {
  draft: HR,
  computed: HR,
  reviewed: HR,
  certified: ACCT,
  approved: CHIEF,
  released: CASHIER,
}

function historyUpTo(status: RunStatus, anchor: string, payDate: string): RunTransition[] {
  const offsets: Record<RunStatus, [number, string]> = {
    draft: [-8, "08:40"],
    computed: [-7, "10:15"],
    reviewed: [-6, "15:32"],
    certified: [-4, "11:05"],
    approved: [-3, "16:20"],
    released: [0, "09:10"],
  }
  const target = RUN_STATUS_ORDER.indexOf(status)
  return RUN_STATUS_ORDER.slice(0, target + 1).map((s) => {
    const [offset, time] = offsets[s]
    const date = s === "released" ? payDate : iso(addDays(parseISO(anchor), offset))
    const actor = ACTORS[s]
    return { status: s, by: actor.name, role: actor.role, at: at(date, time) }
  })
}

function transitionComments(history: RunTransition[]): RunComment[] {
  return history.slice(1).map((h, i) => ({
    id: `c-${h.status}-${i}`,
    author: h.by,
    role: h.role,
    createdAt: h.at,
    body: "",
    kind: "transition",
    fromStatus: history[i]?.status,
    toStatus: h.status,
  }))
}

function runCode(type: "REG" | "SPL", start: string, group: EmployeeGroup, suffix?: string): string {
  const g = group === "plantilla" ? "PL" : "JC"
  return `${type}-${start.slice(0, 7)}-${suffix ?? g}`
}

function buildRegularRun(
  data: EngineData,
  period: PayrollPeriod,
  group: EmployeeGroup,
  status: RunStatus
): PayrollRun {
  const employees = employeesForPeriod(data.employees, group, period.start, period.end)
  const anchor = period.end
  const history = historyUpTo(status, anchor, period.payDate)
  const base: PayrollRun = {
    id: `run-${period.id}-${group}`,
    code: runCode("REG", period.start, group),
    type: "regular",
    title: `Regular Payroll, ${GROUP_LABELS[group]}`,
    group,
    periodId: period.id,
    periodStart: period.start,
    periodEnd: period.end,
    payDate: period.payDate,
    status,
    employeeIds: employees.map((e) => e.id),
    lines: [],
    adjustments: [],
    comments: transitionComments(history),
    history,
    totals: EMPTY_TOTALS,
    createdBy: HR.name,
    createdAt: history[0]?.at ?? at(anchor, "08:00"),
    locked: status === "approved" || status === "released",
    payslipsGeneratedAt: status === "released" ? history.at(-1)?.at : undefined,
  }
  if (status === "draft") return base
  const lines = computeRegularLines(data, base, base.adjustments)
  return { ...base, lines, totals: computeRunTotals(lines) }
}

function buildSpecialRun(
  data: EngineData,
  kind: SpecialPayrollKind,
  month: string,
  status: RunStatus,
  payDate: string
): PayrollRun {
  const { start, end } = monthRange(month)
  const { eligible } = specialEligibility(data, kind, start, end)
  const history = historyUpTo(status, payDate, payDate)
  const label = SPECIAL_KIND_LABELS[kind]
  const monthLabel = format(parseISO(start), "MMMM yyyy")
  const titleSuffix =
    kind === "mid_year_bonus" || kind === "year_end_bonus" || kind === "pei" || kind === "uniform_allowance"
      ? `CY ${start.slice(0, 4)}`
      : monthLabel
  const base: PayrollRun = {
    id: `run-${kind}-${start.slice(0, 7)}`,
    code: runCode("SPL", start, "plantilla", kind.split("_").map((w) => w[0]?.toUpperCase()).join("")),
    type: "special",
    specialKind: kind,
    title: `${label}, ${titleSuffix}`,
    group: "plantilla",
    periodStart: start,
    periodEnd: end,
    payDate,
    status,
    employeeIds: eligible.map((e) => e.id),
    lines: [],
    adjustments: [],
    comments: transitionComments(history),
    history,
    totals: EMPTY_TOTALS,
    createdBy: HR.name,
    createdAt: history[0]?.at ?? at(payDate, "08:00"),
    locked: status === "approved" || status === "released",
    payslipsGeneratedAt: status === "released" ? history.at(-1)?.at : undefined,
  }
  const lines = computeSpecialLines(data, base, base.adjustments)
  return { ...base, lines, totals: computeRunTotals(lines) }
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

const TRANSITION_VERBS: Record<RunStatus, string> = {
  draft: "Created payroll run",
  computed: "Computed payroll",
  reviewed: "Marked payroll as reviewed",
  certified: "Certified payroll",
  approved: "Approved payroll",
  released: "Released payroll",
}

function buildAudit(runs: PayrollRun[], employees: Employee[]): AuditEntry[] {
  const entries: AuditEntry[] = []
  let seq = 1
  const push = (e: Omit<AuditEntry, "id">) => entries.push({ id: `audit-${String(seq++).padStart(4, "0")}`, ...e })

  for (const run of runs) {
    if (run.periodEnd < "2026-06-01") continue
    const label = `${run.code} (${run.type === "regular" ? formatPeriod(run.periodStart, run.periodEnd) : run.title})`
    run.history.forEach((h, i) => {
      push({
        at: h.at,
        userName: h.by,
        role: h.role,
        action: TRANSITION_VERBS[h.status],
        entity: "payroll_run",
        entityId: run.id,
        entityLabel: label,
        before: i > 0 ? `Status: ${run.history[i - 1]?.status}` : undefined,
        after: `Status: ${h.status}`,
      })
    })
  }

  const byTitle = (title: string) => employees.find((e) => e.positionTitle === title)
  const misc: Omit<AuditEntry, "id">[] = [
    {
      at: "2026-01-05T09:14:00.000+08:00", userName: "Carlo M. Reyes", role: "admin",
      action: "Published salary schedule version", entity: "salary_schedule", entityId: "ssl6-t3",
      entityLabel: "SSL VI Third Tranche (effective Jan 1, 2026)", before: "Active: SSL VI Second Tranche", after: "Active: SSL VI Third Tranche",
    },
    {
      at: "2026-06-30T17:42:00.000+08:00", userName: "Carlo M. Reyes", role: "admin",
      action: "Deactivated user", entity: "user", entityId: "user-acct-2", entityLabel: "Nerissa B. Dizon",
      before: "Active", after: "Inactive",
    },
  ]
  const newHire = employees.find((e) => e.dateHired === "2026-09-21")
  if (newHire) {
    misc.push({
      at: "2026-09-18T14:03:00.000+08:00", userName: HR.name, role: "hr",
      action: "Added employee", entity: "employee", entityId: newHire.id, entityLabel: `${fullName(newHire)} (${newHire.employeeNo})`,
      after: `Nurse I, SG 15 Step 1, hired Sep 21, 2026`,
    })
  }
  const retiree = employees.find((e) => e.separationDate === "2026-09-25")
  if (retiree) {
    misc.push({
      at: "2026-09-10T10:21:00.000+08:00", userName: HR.name, role: "hr",
      action: "Recorded separation", entity: "employee", entityId: retiree.id, entityLabel: `${fullName(retiree)} (${retiree.employeeNo})`,
      before: "Status: Active", after: "Status: Separated (compulsory retirement, Sep 25, 2026)",
    })
  }
  const stepped = byTitle("Pharmacist I")
  if (stepped) {
    misc.push({
      at: "2026-08-03T09:47:00.000+08:00", userName: HR.name, role: "hr",
      action: "Updated step increment", entity: "employee", entityId: stepped.id, entityLabel: `${fullName(stepped)} (${stepped.employeeNo})`,
      before: `SG 11 Step ${Math.max(1, (stepped.step ?? 2) - 1)}`, after: `SG 11 Step ${stepped.step ?? 2}`,
    })
  }
  misc.push(
    {
      at: "2026-09-19T08:31:00.000+08:00", userName: HR.name, role: "hr",
      action: "Imported biometric logs", entity: "dtr", entityId: "P202609", entityLabel: "Sep 1 to 30, 2026 (ZKTeco export as of Sep 18, 77 employees)",
      after: "77 records imported, 3 employees without logs",
    },
    {
      at: "2026-09-15T16:05:00.000+08:00", userName: ACCT.name, role: "accountant",
      action: "Marked remittance as paid", entity: "remittance", entityId: "gsis:2026-08-01", entityLabel: "GSIS, Aug 2026",
      before: "Filed", after: "Paid (OR No. GS-2026-0908812)",
    },
    {
      at: "2026-09-22T07:42:00.000+08:00", userName: HR.name, role: "hr",
      action: "Signed in", entity: "session", entityId: "user-hr", entityLabel: HR.name,
    },
  )
  for (const m of misc) push(m)

  return entries.sort((a, b) => b.at.localeCompare(a.at))
}

/* ------------------------------------------------------------------ */
/* Remittance filings                                                  */
/* ------------------------------------------------------------------ */

function buildFilings(f: Faker): Record<string, RemittanceFiling> {
  const filings: Record<string, RemittanceFiling> = {}
  const agencies = ["gsis", "philhealth", "pagibig", "bir"] as const
  const prefixes = { gsis: "GS", philhealth: "PH", pagibig: "HD", bir: "BIR" }
  for (let i = 0; i < 12; i++) {
    const month = iso(addMonths(parseISO("2025-10-01"), i))
    for (const agency of agencies) {
      const key = `${agency}:${month}`
      const due = addMonths(parseISO(month), 1)
      if (month < "2026-08-01") {
        filings[key] = {
          status: "paid",
          referenceNo: `${prefixes[agency]}-${month.slice(0, 4)}-${digits(f, 7)}`,
          filedAt: iso(addDays(due, 4)),
          paidAt: iso(addDays(due, 6)),
        }
      } else if (month === "2026-08-01") {
        const paid = agency === "gsis" || agency === "philhealth"
        filings[key] = {
          status: paid ? "paid" : "filed",
          referenceNo: `${prefixes[agency]}-2026-${digits(f, 7)}`,
          filedAt: "2026-09-08",
          paidAt: paid ? "2026-09-10" : undefined,
        }
      } else {
        filings[key] = { status: "pending" }
      }
    }
  }
  return filings
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function createSeed(): DemoData {
  const f = new Faker({ locale: [base] })
  f.seed(20260922)
  f.setDefaultRefDate(parseISO(DEMO_TODAY))

  const generated = buildEmployees(f)
  const employees = generated.map((g) => g.employee)
  const positions = buildPositions(employees, f)
  const periods = buildPeriods("2025-10-01", "2026-11-01")
  const dtr = buildDtr(f, generated, periods)
  const leaveCredits = buildLeaveCredits(f, employees)
  const loans = buildLoans(f, employees)

  const data: EngineData = {
    employees,
    salarySchedules: SEED_SALARY_SCHEDULES,
    ratesVersions: SEED_RATES,
    allowanceTypes: SEED_ALLOWANCE_TYPES,
    dtr,
    loans,
    periods,
  }

  const runs: PayrollRun[] = []
  for (const period of periods) {
    if (period.start > "2026-09-01") break
    if (period.id === CURRENT_PERIOD_ID) {
      // Plantilla is in Draft; the JO/COS run for September is not created yet.
      runs.push(buildRegularRun(data, period, "plantilla", "draft"))
      continue
    }
    runs.push(buildRegularRun(data, period, "plantilla", "released"))
    runs.push(buildRegularRun(data, period, "jo_cos", "released"))
  }

  runs.push(
    buildSpecialRun(data, "year_end_bonus", "2025-11-01", "released", "2025-11-14"),
    buildSpecialRun(data, "pei", "2025-12-01", "released", "2025-12-15"),
    buildSpecialRun(data, "uniform_allowance", "2026-02-01", "released", "2026-02-20"),
    buildSpecialRun(data, "mid_year_bonus", "2026-05-01", "released", "2026-05-15"),
    buildSpecialRun(data, "hazard_pay", "2026-07-01", "released", "2026-08-07"),
    buildSpecialRun(data, "subsistence_laundry", "2026-07-01", "released", "2026-08-07"),
    buildSpecialRun(data, "hazard_pay", "2026-08-01", "reviewed", "2026-09-25"),
    buildSpecialRun(data, "subsistence_laundry", "2026-08-01", "certified", "2026-09-25"),
  )

  // Story details on a few runs
  const aug2 = runs.find((r) => r.id === "run-P202608-plantilla")
  if (aug2) {
    const returnedAt = at("2026-08-26", "09:40")
    aug2.comments.splice(2, 0, {
      id: "c-aug-return",
      author: ACCT.name,
      role: "accountant",
      createdAt: returnedAt,
      body: "Overtime for Nursing on Aug 24 to 28 does not match the approved OT authority. Please recheck against the signed authority and recompute.",
      kind: "return",
      fromStatus: "reviewed",
      toStatus: "computed",
    }, {
      id: "c-aug-reply",
      author: HR.name,
      role: "hr",
      createdAt: at("2026-08-26", "16:48"),
      body: "Corrected. Two OT entries were outside the approved authority and have been removed from the DTR.",
      kind: "comment",
    })
  }
  const joAug = runs.find((r) => r.id === "run-P202608-jo_cos")
  if (joAug) {
    const guard = employees.find((e) => e.positionTitle === "Security Guard (JO)")
    if (guard) {
      joAug.adjustments.push({
        id: "adj-seed-1",
        employeeId: guard.id,
        kind: "earning",
        label: "Unpaid service, Jul 30 to 31, 2026",
        amount: (guard.contractRate ?? 0) * 2,
        reason: "Guard logbook confirms duty on Jul 30 to 31; biometric device at the gate was offline.",
        createdBy: HR.name,
        createdAt: at("2026-08-24", "10:22"),
      })
      joAug.lines = computeRegularLines(data, joAug, joAug.adjustments)
      joAug.totals = computeRunTotals(joAug.lines)
    }
    joAug.comments.splice(1, 0, {
      id: "c-jo-note",
      author: HR.name,
      role: "hr",
      createdAt: at("2026-08-24", "15:40"),
      body: "DTR of the security guards validated against the guard logbook. Ready for certification.",
      kind: "comment",
    })
  }
  const hazard = runs.find((r) => r.id === "run-hazard_pay-2026-08")
  if (hazard) {
    hazard.comments.push({
      id: "c-hazard-note",
      author: ACCT.name,
      role: "accountant",
      createdAt: at("2026-09-21", "11:08"),
      body: "Funds available under MOOE, Personnel Services. Certified as to availability of allotment (ORS No. 2026-09-0412).",
      kind: "comment",
    })
  }

  return {
    users: SEED_USERS.map((u) => ({ ...u })),
    departments: SEED_DEPARTMENTS.map((d) => ({ ...d })),
    employees,
    positions,
    salarySchedules: SEED_SALARY_SCHEDULES.map((s) => ({ ...s, matrix: s.matrix.map((r) => [...r]) })),
    ratesVersions: SEED_RATES.map((r) => structuredClone(r)),
    allowanceTypes: SEED_ALLOWANCE_TYPES.map((a) => ({ ...a })),
    signatories: SEED_SIGNATORIES.map((s) => ({ ...s })),
    periods,
    dtr,
    leaveCredits,
    loans,
    runs,
    remittanceFilings: buildFilings(f),
    audit: buildAudit(runs, employees),
  }
}
