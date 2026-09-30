import type {
  Agency,
  EmployeeGroup,
  EmployeeStatus,
  EmploymentType,
  LoanStatus,
  LoanType,
  RemittanceStatus,
  Role,
  RunStatus,
  SpecialPayrollKind,
} from "@/types"

export const HOSPITAL = {
  name: "Mariveles Mental Wellness and General Hospital",
  short: "MMWGH",
  address: "Barangay Alas-asin, Mariveles, Bataan 2105",
  agency: "Department of Health",
  tin: "000-123-456-000",
  gsisEmployerNo: "10054-0087",
  philhealthEmployerNo: "20-000123456-7",
  pagibigEmployerNo: "2011-0012-3456",
} as const

export const ROLE_LABELS: Record<Role, string> = {
  hr: "HR Payroll Officer",
  accountant: "Accountant",
  chief: "Chief of Hospital",
  cashier: "Cashier",
  admin: "System Admin",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  hr: "Manages employees and attendance, prepares and computes payroll",
  accountant: "Reviews and certifies payroll, manages remittances",
  chief: "Approves payroll for release",
  cashier: "Releases approved payroll and payslips",
  admin: "Maintains settings, rate tables, and user access",
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent: "Permanent",
  casual: "Casual",
  contractual: "Contractual",
  job_order: "Job Order",
  contract_of_service: "Contract of Service",
}

export const EMPLOYMENT_TYPE_SHORT: Record<EmploymentType, string> = {
  permanent: "Permanent",
  casual: "Casual",
  contractual: "Contractual",
  job_order: "JO",
  contract_of_service: "COS",
}

export const GROUP_LABELS: Record<EmployeeGroup, string> = {
  plantilla: "Plantilla",
  jo_cos: "JO/COS",
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  suspended: "Suspended",
  separated: "Separated",
}

export const RUN_STATUS_ORDER: RunStatus[] = [
  "draft",
  "computed",
  "reviewed",
  "certified",
  "approved",
  "released",
]

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  draft: "Draft",
  computed: "Computed",
  reviewed: "Reviewed",
  certified: "Certified",
  approved: "Approved",
  released: "Released",
}

export const SPECIAL_KIND_LABELS: Record<SpecialPayrollKind, string> = {
  mid_year_bonus: "Mid-Year Bonus",
  year_end_bonus: "Year-End Bonus and Cash Gift",
  pei: "Productivity Enhancement Incentive",
  hazard_pay: "Hazard Pay",
  subsistence_laundry: "Subsistence and Laundry Allowance",
  uniform_allowance: "Uniform Allowance",
}

export const SPECIAL_KIND_BASIS: Record<SpecialPayrollKind, string> = {
  mid_year_bonus: "RA 11466 and DBM Budget Circular No. 2017-2. One month basic salary as of May 15.",
  year_end_bonus: "RA 11466 and DBM Budget Circular No. 2016-4. One month basic salary plus cash gift.",
  pei: "Administrative Order on the grant of PEI. Uniform amount per qualified employee.",
  hazard_pay: "RA 7305, Sec. 21. Percentage of monthly basic by salary grade.",
  subsistence_laundry: "RA 7305, Sec. 22. Daily subsistence plus monthly laundry allowance.",
  uniform_allowance: "DBM Budget Circular on Uniform or Clothing Allowance. Annual grant.",
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  gsis_consoloan: "GSIS Consolidated Loan",
  gsis_emergency: "GSIS Emergency Loan",
  gsis_policy: "GSIS Policy Loan",
  gsis_mpl: "GSIS Multi-Purpose Loan",
  pagibig_mpl: "Pag-IBIG Multi-Purpose Loan",
  pagibig_calamity: "Pag-IBIG Calamity Loan",
  cooperative: "MMWGH Employees Cooperative",
  landbank: "Landbank Salary Loan",
  other: "Other Authorized Deduction",
}

export const LOAN_TYPE_AGENCY: Record<LoanType, string> = {
  gsis_consoloan: "GSIS",
  gsis_emergency: "GSIS",
  gsis_policy: "GSIS",
  gsis_mpl: "GSIS",
  pagibig_mpl: "Pag-IBIG",
  pagibig_calamity: "Pag-IBIG",
  cooperative: "Cooperative",
  landbank: "Landbank",
  other: "Other",
}

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: "Active",
  fully_paid: "Fully paid",
  suspended: "Suspended",
}

export const AGENCY_LABELS: Record<Agency, string> = {
  gsis: "GSIS",
  philhealth: "PhilHealth",
  pagibig: "Pag-IBIG",
  bir: "BIR",
}

export const AGENCY_FULL: Record<Agency, string> = {
  gsis: "Government Service Insurance System",
  philhealth: "Philippine Health Insurance Corporation",
  pagibig: "Home Development Mutual Fund",
  bir: "Bureau of Internal Revenue (Form 1601-C)",
}

export const REMITTANCE_STATUS_LABELS: Record<RemittanceStatus, string> = {
  pending: "Pending",
  filed: "Filed",
  paid: "Paid",
}

export function groupOf(type: EmploymentType): EmployeeGroup {
  return type === "job_order" || type === "contract_of_service" ? "jo_cos" : "plantilla"
}
