import type { Employee, PayrollPeriod, RatesConfig, SalarySchedule } from "@/types"

import { pesos } from "../money"
import { SEED_ALLOWANCE_TYPES, SEED_RATES } from "../rates"

export const rates: RatesConfig = SEED_RATES[SEED_RATES.length - 1]!
export const allowanceTypes = SEED_ALLOWANCE_TYPES

/** Simple schedule: SG n step s = (10,000 + 2,000 * (n - 1) + 100 * (s - 1)) pesos. */
export const schedule: SalarySchedule = {
  id: "test",
  name: "Test schedule",
  legalBasis: "Test",
  effectivityDate: "2026-01-01",
  createdBy: "test",
  createdAt: "2026-01-01T00:00:00.000Z",
  matrix: Array.from({ length: 33 }, (_, g) =>
    Array.from({ length: 8 }, (_, s) => pesos(10_000 + 2_000 * g + 100 * s))
  ),
}

/** September 2026: 22 working days (no holidays; Sep 1 is a Tuesday). */
export const periodSeptember: PayrollPeriod = {
  id: "P202609",
  start: "2026-09-01",
  end: "2026-09-30",
  workingDays: 22,
  payDate: "2026-09-30",
}

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    employeeNo: "2015-0001",
    firstName: "Maria",
    middleName: "Reyes",
    lastName: "Santos",
    sex: "female",
    civilStatus: "married",
    birthDate: "1988-04-12",
    address: "Mariveles, Bataan",
    mobile: "0917 555 0101",
    email: "maria.santos@mmwgh.doh.gov.ph",
    tin: "123-456-789-000",
    gsisBpNo: "02-00123456789",
    philhealthNo: "12-345678901-2",
    pagibigMid: "1210-2345-6789",
    departmentId: "dept-nursing",
    positionTitle: "Nurse II",
    employmentType: "permanent",
    status: "active",
    dateHired: "2015-06-01",
    itemNo: "MMWGH-NURS2-000101-2015",
    salaryGrade: 16,
    step: 1,
    rateType: "salary_grade",
    isHealthWorker: true,
    bankAccountNo: "0123-4567-89",
    allowances: [],
    documents: [],
    ...overrides,
  }
}

export function makeJobOrder(overrides: Partial<Employee> = {}): Employee {
  return makeEmployee({
    id: "emp-jo",
    employeeNo: "JO-2026-0001",
    positionTitle: "Utility Worker (JO)",
    employmentType: "job_order",
    itemNo: undefined,
    salaryGrade: undefined,
    step: undefined,
    gsisBpNo: undefined,
    rateType: "daily",
    contractRate: pesos(600),
    isHealthWorker: false,
    swornDeclaration: true,
    dateHired: "2024-01-02",
    ...overrides,
  })
}
