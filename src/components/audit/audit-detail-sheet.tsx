"use client"

import type { AuditEntry } from "@/types"
import { ROLE_LABELS } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import { InfoGrid } from "@/components/info-grid"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

import { ENTITY_LABELS } from "./audit-labels"

function ValueBox({ title, value }: { title: string; value?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <pre className="min-h-16 rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
        {value ? value.split("; ").join("\n") : <span className="text-muted-foreground">No value recorded</span>}
      </pre>
    </div>
  )
}

export function AuditDetailSheet({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
        {entry && (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle>{entry.action}</SheetTitle>
              <SheetDescription>{entry.entityLabel}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
              <InfoGrid
                columns={2}
                items={[
                  { label: "Timestamp", value: formatDateTime(entry.at) },
                  { label: "User", value: entry.userName },
                  { label: "Role", value: <Badge variant="outline">{ROLE_LABELS[entry.role]}</Badge> },
                  { label: "Entity", value: ENTITY_LABELS[entry.entity] },
                  { label: "Record", value: <span className="whitespace-normal">{entry.entityLabel}</span>, span: 2 },
                  { label: "Record ID", value: entry.entityId, mono: true },
                  { label: "Entry ID", value: entry.id, mono: true },
                ]}
              />
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <ValueBox title="Before" value={entry.before} />
                <ValueBox title="After" value={entry.after} />
              </div>
              <p className="text-xs text-muted-foreground">
                Audit entries are append-only and cannot be edited or deleted.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
