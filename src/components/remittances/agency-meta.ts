import type { Agency, Employee, Remittance } from "@/types"
import type { ExportFormat } from "@/hooks/use-mock-export"
import { DEMO_TODAY } from "@/data/seed"

export interface AgencyExport {
  label: string
  title: string
  format: ExportFormat
  stem: string
}

/** Agency-specific export formats for the remittance schedule. */
export const AGENCY_EXPORTS: Record<Agency, AgencyExport[]> = {
  gsis: [{ label: "Remittance File (Excel)", title: "GSIS Remittance File", format: "Excel", stem: "gsis-remittance-file" }],
  philhealth: [{ label: "RF-1 (CSV)", title: "PhilHealth RF-1", format: "CSV", stem: "philhealth-rf1" }],
  pagibig: [{ label: "MCRF (Excel)", title: "Pag-IBIG MCRF", format: "Excel", stem: "pagibig-mcrf" }],
  bir: [
    { label: "1601-C (PDF)", title: "BIR Form 1601-C", format: "PDF", stem: "bir-1601c" },
    { label: "Alphalist (DAT)", title: "BIR Alphalist", format: "DAT", stem: "bir-alphalist" },
  ],
}

export const AGENCY_ID_LABEL: Record<Agency, string> = {
  gsis: "GSIS BP No.",
  philhealth: "PhilHealth No.",
  pagibig: "Pag-IBIG MID",
  bir: "TIN",
}

export function agencyId(agency: Agency, employee: Employee): string {
  switch (agency) {
    case "gsis":
      return employee.gsisBpNo ?? "Not a member"
    case "philhealth":
      return employee.philhealthNo
    case "pagibig":
      return employee.pagibigMid
    case "bir":
      return employee.tin
  }
}

export const AGENCY_DESCRIPTIONS: Record<Agency, string> = {
  gsis: "Life and retirement premiums from the personal and government shares, plus the Employees' Compensation (ECC) contribution. Due on the 10th of the following month.",
  philhealth: "National Health Insurance Program premiums, shared equally by the employee and the hospital. Due on the 15th of the following month.",
  pagibig: "Home Development Mutual Fund savings contributions from the employee and the hospital. Due on the 15th of the following month.",
  bir: "Monthly remittance of income taxes withheld on compensation. Due on the 10th of the following month.",
}

export function isOverdue(r: Pick<Remittance, "status" | "dueDate">): boolean {
  return r.status === "pending" && r.dueDate < DEMO_TODAY
}
