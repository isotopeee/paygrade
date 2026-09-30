/**
 * Domain types for PayGrade.
 *
 * Money is always stored as integer centavos (type `Centavos`). Dates are ISO
 * `yyyy-MM-dd` strings; timestamps are full ISO strings.
 */

export type Centavos = number
export type ISODate = string
export type ISODateTime = string

/* ------------------------------------------------------------------ */
/* Roles and users                                                     */
/* ------------------------------------------------------------------ */

export type Role = "hr" | "accountant" | "chief" | "cashier" | "admin"

export interface AppUser {
  id: string
  name: string
  position: string
  role: Role
  email: string
  initials: string
  active: boolean
  lastLogin?: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Organization                                                        */
/* ------------------------------------------------------------------ */

export interface Department {
  id: string
  code: string
  name: string
  costCenter: string
  head: string
}

export type EmploymentType =
  | "permanent"
  | "casual"
  | "contractual"
  | "job_order"
  | "contract_of_service"

/** Payroll group. Plantilla covers permanent, casual, and contractual. */
export type EmployeeGroup = "plantilla" | "jo_cos"

export type EmployeeStatus = "active" | "on_leave" | "suspended" | "separated"

export type RateType = "salary_grade" | "daily" | "monthly"

export type Sex = "male" | "female"
export type CivilStatus = "single" | "married" | "widowed" | "separated"

export interface EmployeeAllowance {
  allowanceTypeId: string
  /** Monthly amount in centavos. Overrides the default amount when set. */
  amount: Centavos
}

export interface EmployeeDocument {
  id: string
  name: string
  kind: "appointment" | "oath" | "pds" | "saln" | "contract" | "clearance" | "id"
  uploadedAt: ISODate
  sizeKb: number
}

export interface Employee {
  id: string
  employeeNo: string
  firstName: string
  middleName: string
  lastName: string
  suffix?: string
  sex: Sex
  civilStatus: CivilStatus
  birthDate: ISODate
  address: string
  mobile: string
  email: string

  // Government identifiers
  tin: string
  gsisBpNo?: string
  philhealthNo: string
  pagibigMid: string

  // Employment
  departmentId: string
  positionTitle: string
  employmentType: EmploymentType
  status: EmployeeStatus
  dateHired: ISODate
  separationDate?: ISODate
  /** Plantilla item number (plantilla only). */
  itemNo?: string
  salaryGrade?: number
  step?: number
  lastStepIncrement?: ISODate
  rateType: RateType
  /** Daily or monthly contract rate in centavos (JO/COS only). */
  contractRate?: Centavos
  contractEnd?: ISODate
  /** Covered by RA 7305 Magna Carta for Public Health Workers. */
  isHealthWorker: boolean
  /** JO/COS sworn declaration that annual income will not exceed the tax exemption threshold. */
  swornDeclaration?: boolean

  bankAccountNo: string
  allowances: EmployeeAllowance[]
  documents: EmployeeDocument[]
}

export interface Position {
  id: string
  itemNo: string
  title: string
  salaryGrade: number
  departmentId: string
  employeeId?: string
  dateCreated: ISODate
  authorization: string
}

/* ------------------------------------------------------------------ */
/* Salary schedule                                                     */
/* ------------------------------------------------------------------ */

export interface SalarySchedule {
  id: string
  name: string
  legalBasis: string
  effectivityDate: ISODate
  /** matrix[grade - 1][step - 1] in centavos. 33 grades by 8 steps. */
  matrix: Centavos[][]
  createdBy: string
  createdAt: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Leave                                                               */
/* ------------------------------------------------------------------ */

export interface LeaveCredit {
  employeeId: string
  vacationLeave: number
  sickLeave: number
  specialPrivilegeLeave: number
  forcedLeave: number
  asOf: ISODate
}

/* ------------------------------------------------------------------ */
/* Time and attendance                                                 */
/* ------------------------------------------------------------------ */

export interface PayrollPeriod {
  id: string
  start: ISODate
  end: ISODate
  /** Working days (Mon to Fri, excluding holidays) inside the period. */
  workingDays: number
  /** Pay date (the last day of the month). */
  payDate: ISODate
}

export interface DtrSummary {
  employeeId: string
  periodId: string
  /** Days required in the period (working days, adjusted for hire or separation). */
  daysRequired: number
  daysWorked: number
  leaveWithPayDays: number
  absencesWithoutPay: number
  tardinessMinutes: number
  undertimeMinutes: number
  overtimeHoursRegular: number
  overtimeHoursRestDay: number
  nightDiffHours: number
  source: "biometric" | "manual" | "import"
}

export interface DtrDailyEntry {
  date: ISODate
  weekday: string
  kind: "workday" | "weekend" | "holiday" | "leave" | "absent" | "not_employed"
  amIn?: string
  amOut?: string
  pmIn?: string
  pmOut?: string
  lateMinutes: number
  undertimeMinutes: number
  overtimeHours: number
  nightDiffHours: number
  remarks?: string
}

/* ------------------------------------------------------------------ */
/* Loans and deductions                                                */
/* ------------------------------------------------------------------ */

export type LoanType =
  | "gsis_consoloan"
  | "gsis_emergency"
  | "gsis_policy"
  | "gsis_mpl"
  | "pagibig_mpl"
  | "pagibig_calamity"
  | "cooperative"
  | "landbank"
  | "other"

export type LoanStatus = "active" | "fully_paid" | "suspended"

export interface Loan {
  id: string
  employeeId: string
  type: LoanType
  referenceNo: string
  principal: Centavos
  /** Monthly amortization, deducted in full from each monthly payroll. */
  monthlyAmortization: Centavos
  totalPayable: Centavos
  startPeriod: ISODate
  endPeriod: ISODate
  termMonths: number
  paidToDate: Centavos
  status: LoanStatus
}

/* ------------------------------------------------------------------ */
/* Payroll                                                             */
/* ------------------------------------------------------------------ */

export type RunStatus =
  | "draft"
  | "computed"
  | "reviewed"
  | "certified"
  | "approved"
  | "released"

export type RunType = "regular" | "special"

export type SpecialPayrollKind =
  | "mid_year_bonus"
  | "year_end_bonus"
  | "pei"
  | "hazard_pay"
  | "subsistence_laundry"
  | "uniform_allowance"

export interface LineItem {
  code: string
  label: string
  amount: Centavos
}

export interface Adjustment {
  id: string
  employeeId: string
  kind: "earning" | "deduction"
  label: string
  amount: Centavos
  reason: string
  createdBy: string
  createdAt: ISODateTime
}

export interface PayrollLine {
  employeeId: string
  employeeNo: string
  employeeName: string
  departmentId: string
  positionTitle: string
  group: EmployeeGroup
  /** Monthly basic salary or monthly equivalent of a contract rate. */
  monthlyRate: Centavos
  /** Basic pay for the period before attendance deductions. */
  basicScheduled: Centavos
  tardinessUndertime: Centavos
  absences: Centavos
  /** Earned basic after attendance deductions. */
  basic: Centavos
  pera: Centavos
  allowances: LineItem[]
  allowancesTotal: Centavos
  overtime: Centavos
  nightDiff: Centavos
  otherEarnings: LineItem[]
  gross: Centavos
  taxableIncome: Centavos

  gsis: Centavos
  gsisGovernment: Centavos
  ecc: Centavos
  philhealth: Centavos
  philhealthGovernment: Centavos
  pagibig: Centavos
  pagibigGovernment: Centavos
  withholdingTax: Centavos
  loans: LineItem[]
  loansTotal: Centavos
  otherDeductions: LineItem[]
  otherDeductionsTotal: Centavos
  totalDeductions: Centavos
  net: Centavos
  /** Exceptions and notes from computation (for example, net below threshold). */
  flags: string[]
  /** Explanation strings for the computation breakdown sheet. */
  notes: string[]
}

export interface RunComment {
  id: string
  author: string
  role: Role
  createdAt: ISODateTime
  body: string
  kind: "comment" | "transition" | "return"
  fromStatus?: RunStatus
  toStatus?: RunStatus
}

export interface RunTransition {
  status: RunStatus
  by: string
  role: Role
  at: ISODateTime
  /** True when the run was sent back to this status (a return, not forward progress). */
  returned?: boolean
}

export interface RunTotals {
  headcount: number
  gross: Centavos
  totalDeductions: Centavos
  net: Centavos
  gsis: Centavos
  gsisGovernment: Centavos
  ecc: Centavos
  philhealth: Centavos
  philhealthGovernment: Centavos
  pagibig: Centavos
  pagibigGovernment: Centavos
  withholdingTax: Centavos
  loans: Centavos
}

export interface PayrollRun {
  id: string
  code: string
  type: RunType
  specialKind?: SpecialPayrollKind
  title: string
  group: EmployeeGroup
  periodId?: string
  periodStart: ISODate
  periodEnd: ISODate
  payDate: ISODate
  status: RunStatus
  employeeIds: string[]
  lines: PayrollLine[]
  adjustments: Adjustment[]
  comments: RunComment[]
  history: RunTransition[]
  totals: RunTotals
  createdBy: string
  createdAt: ISODateTime
  locked: boolean
  payslipsGeneratedAt?: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Remittances                                                         */
/* ------------------------------------------------------------------ */

export type Agency = "gsis" | "philhealth" | "pagibig" | "bir"
export type RemittanceStatus = "pending" | "filed" | "paid"

export interface Remittance {
  id: string
  agency: Agency
  /** First day of the month covered, `yyyy-MM-01`. */
  month: ISODate
  employeeShare: Centavos
  governmentShare: Centavos
  headcount: number
  dueDate: ISODate
  status: RemittanceStatus
  referenceNo?: string
  filedAt?: ISODate
  paidAt?: ISODate
}

/** Filing status of a monthly remittance. Amounts are derived from payroll runs. */
export interface RemittanceFiling {
  status: RemittanceStatus
  referenceNo?: string
  filedAt?: ISODate
  paidAt?: ISODate
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface TaxBracket {
  /** Lower bound (exclusive) in centavos. Tax applies to the excess over this amount. */
  over: Centavos
  /** Upper bound (inclusive) in centavos, or null for the top bracket. */
  upTo: Centavos | null
  baseTax: Centavos
  /** Marginal rate applied to the excess over `over`. */
  rate: number
}

export interface RatesConfig {
  id: string
  label: string
  effectivityDate: ISODate
  legalBasis: string
  createdBy: string
  createdAt: ISODateTime

  gsis: {
    personalRate: number
    governmentRate: number
    /** Employees' Compensation (ECC) government share per month. */
    eccMonthly: Centavos
  }
  philhealth: {
    premiumRate: number
    /** Share of the premium paid by the employee (0.5 = split equally). */
    employeeShare: number
    floor: Centavos
    ceiling: Centavos
  }
  pagibig: {
    /** Employee rate when monthly compensation is at or below the low-income threshold. */
    employeeRateLow: number
    employeeRate: number
    employerRate: number
    lowIncomeThreshold: Centavos
    /** Maximum monthly fund salary used for computing contributions. */
    maxFundSalary: Centavos
  }
  withholding: {
    /** Semi-monthly compensation withholding tax table (kept for reference; payroll is monthly). */
    semiMonthly: TaxBracket[]
    monthly: TaxBracket[]
    annual: TaxBracket[]
  }
  /** Personal Economic Relief Allowance per month. */
  peraMonthly: Centavos
  workingDaysPerMonth: number
  hoursPerDay: number
  overtime: {
    regularDayMultiplier: number
    restDayMultiplier: number
  }
  nightDiff: {
    rate: number
    maxSalaryGrade: number
  }
  /** Minimum monthly net take-home pay under the General Appropriations Act. */
  minimumNetPayMonthly: Centavos
  joCos: {
    /** Withholding rate for JO/COS without a sworn declaration. */
    withholdingRate: number
  }
  magnaCarta: {
    subsistencePerDay: Centavos
    subsistenceMaxDays: number
    laundryMonthly: Centavos
    /** Hazard pay rate by salary grade band. Checked in order, first match wins. */
    hazardRates: { maxSalaryGrade: number; rate: number }[]
    /** Longevity pay: rate of monthly basic for every block of years in service. */
    longevityRate: number
    longevityYearsPerBlock: number
  }
  bonuses: {
    cashGift: Centavos
    pei: Centavos
    uniformAllowance: Centavos
    minimumMonthsForBonus: number
    /** Annual tax exemption ceiling for 13th month pay and other benefits (TRAIN). */
    exemptionCeiling: Centavos
  }
  leaveMonetization: {
    /** Vacation leave days that must remain after monetization. */
    retainedDays: number
    /** Maximum days monetized per application. */
    maxDaysPerApplication: number
  }
}

export interface AllowanceType {
  id: string
  code: string
  name: string
  defaultMonthly: Centavos
  taxable: boolean
  appliesTo: "plantilla" | "jo_cos" | "all"
  legalBasis: string
  active: boolean
}

export interface Signatory {
  id: string
  role: "prepared_by" | "reviewed_by" | "certified_by" | "approved_by" | "released_by"
  label: string
  name: string
  position: string
}

/* ------------------------------------------------------------------ */
/* Audit and activity                                                  */
/* ------------------------------------------------------------------ */

export type AuditEntity =
  | "employee"
  | "payroll_run"
  | "adjustment"
  | "salary_schedule"
  | "rates"
  | "allowance"
  | "department"
  | "signatory"
  | "user"
  | "loan"
  | "remittance"
  | "dtr"
  | "payslip"
  | "session"
  | "position"
  | "report"
  | "audit"

export interface AuditEntry {
  id: string
  at: ISODateTime
  userName: string
  role: Role
  action: string
  entity: AuditEntity
  entityId: string
  entityLabel: string
  before?: string
  after?: string
}
