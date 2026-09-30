import {
  BanknoteIcon,
  BriefcaseBusinessIcon,
  ClockIcon,
  FileBarChartIcon,
  GiftIcon,
  HandCoinsIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  keywords?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon, keywords: "home kpi summary" }],
  },
  {
    label: "Workforce",
    items: [
      { title: "Employees", href: "/employees", icon: UsersIcon, keywords: "staff directory 201 file" },
      { title: "Positions and Salary", href: "/positions", icon: BriefcaseBusinessIcon, keywords: "plantilla items salary grade ssl tranche" },
      { title: "Time and Attendance", href: "/attendance", icon: ClockIcon, keywords: "dtr biometric tardiness overtime" },
    ],
  },
  {
    label: "Payroll",
    items: [
      { title: "Payroll Runs", href: "/payroll", icon: BanknoteIcon, keywords: "register compute approve release" },
      { title: "Special Payroll", href: "/special-payroll", icon: GiftIcon, keywords: "bonus pei hazard subsistence laundry uniform" },
      { title: "Payslips", href: "/payslips", icon: ReceiptTextIcon, keywords: "pay slip print" },
      { title: "Deductions and Loans", href: "/loans", icon: HandCoinsIcon, keywords: "gsis pag-ibig mpl cooperative amortization" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { title: "Remittances", href: "/remittances", icon: LandmarkIcon, keywords: "gsis philhealth pagibig bir 1601-c" },
      { title: "Reports", href: "/reports", icon: FileBarChartIcon, keywords: "general payroll alphalist 2316" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Settings", href: "/settings", icon: SettingsIcon, keywords: "rates tax tables allowances departments signatories users" },
      { title: "Audit Log", href: "/audit-log", icon: ScrollTextIcon, keywords: "history trail changes" },
    ],
  },
]

export const NAV_ITEMS = NAV.flatMap((g) => g.items)

/** Static labels for breadcrumb segments. Dynamic segments are resolved by the top bar. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  positions: "Positions and Salary",
  attendance: "Time and Attendance",
  payroll: "Payroll Runs",
  "special-payroll": "Special Payroll",
  payslips: "Payslips",
  loans: "Deductions and Loans",
  remittances: "Remittances",
  reports: "Reports",
  settings: "Settings",
  "audit-log": "Audit Log",
  new: "New run",
  "general-payroll": "General Payroll",
  "payroll-register": "Payroll Register",
  "summary-by-department": "Summary by Department",
  "bir-2316": "BIR Form 2316",
  alphalist: "Alphalist",
  "leave-monetization": "Leave Monetization",
}
