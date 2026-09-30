import type { Role } from "@/types"

/**
 * Role-based permissions for the prototype. UI components call `can(role, ...)`
 * to hide or disable actions. Payroll workflow transitions are governed by
 * `@/lib/workflow` instead.
 */
export type Permission =
  | "employees.manage"
  | "attendance.manage"
  | "positions.manage"
  | "salary_schedule.manage"
  | "payroll.create"
  | "payroll.adjust"
  | "payslips.generate"
  | "loans.manage"
  | "remittances.manage"
  | "reports.export"
  | "settings.manage"
  | "users.manage"
  | "audit.view"

const MATRIX: Record<Permission, Role[]> = {
  "employees.manage": ["hr"],
  "attendance.manage": ["hr"],
  "positions.manage": ["hr", "admin"],
  "salary_schedule.manage": ["admin"],
  "payroll.create": ["hr"],
  "payroll.adjust": ["hr"],
  "payslips.generate": ["hr", "cashier"],
  "loans.manage": ["hr", "accountant"],
  "remittances.manage": ["accountant"],
  "reports.export": ["hr", "accountant", "chief", "cashier", "admin"],
  "settings.manage": ["admin"],
  "users.manage": ["admin"],
  "audit.view": ["hr", "accountant", "chief", "cashier", "admin"],
}

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  return MATRIX[permission].includes(role)
}

export function rolesFor(permission: Permission): Role[] {
  return MATRIX[permission]
}
