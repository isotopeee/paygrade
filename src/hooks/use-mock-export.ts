"use client"

import { toast } from "sonner"

import type { AuditEntity } from "@/types"
import { useDataStore } from "@/stores/data-store"

export type ExportFormat = "PDF" | "Excel" | "CSV" | "DAT"

const EXTENSIONS: Record<ExportFormat, string> = {
  PDF: "pdf",
  Excel: "xlsx",
  CSV: "csv",
  DAT: "dat",
}

/**
 * Mock export: no file is produced. Shows a toast with the file name that a
 * real export would create and records the action in the audit log.
 */
export function useMockExport() {
  const logAudit = useDataStore((s) => s.logAudit)
  return (options: {
    title: string
    format: ExportFormat
    fileStem: string
    entity?: AuditEntity
    entityId?: string
    rows?: number
  }) => {
    const fileName = `${options.fileStem}.${EXTENSIONS[options.format]}`
    toast.success(`${options.title} exported`, {
      description: `${fileName}${options.rows !== undefined ? `, ${options.rows} rows` : ""}. Mock export, no file was generated.`,
    })
    logAudit({
      action: `Exported ${options.title} (${options.format})`,
      entity: options.entity ?? "payroll_run",
      entityId: options.entityId ?? options.fileStem,
      entityLabel: fileName,
    })
  }
}
