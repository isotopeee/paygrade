"use client"

import {
  FileBadgeIcon,
  FileCheckIcon,
  FileSignatureIcon,
  FileTextIcon,
  FolderOpenIcon,
  IdCardIcon,
  ScrollTextIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { Employee, EmployeeDocument } from "@/types"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const KIND: Record<EmployeeDocument["kind"], { label: string; icon: LucideIcon }> = {
  appointment: { label: "Appointment", icon: FileBadgeIcon },
  oath: { label: "Oath of Office", icon: ScrollTextIcon },
  pds: { label: "Personal Data Sheet", icon: FileTextIcon },
  saln: { label: "SALN", icon: FileCheckIcon },
  contract: { label: "Contract", icon: FileSignatureIcon },
  clearance: { label: "Clearance", icon: FileCheckIcon },
  id: { label: "ID", icon: IdCardIcon },
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

export function DocumentsTab({ employee, canManage }: { employee: Employee; canManage: boolean }) {
  const documents = [...employee.documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  const upload = () =>
    toast.info("Upload is simulated", {
      description: "This prototype does not store files. No document was added to the 201 file.",
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>201 file</CardTitle>
        <CardDescription>Appointment papers, contracts, and other personnel records.</CardDescription>
        {canManage && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={upload}>
              <UploadIcon data-icon="inline-start" aria-hidden />
              Upload document
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <Empty className="border py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpenIcon />
              </EmptyMedia>
              <EmptyTitle>No documents on file</EmptyTitle>
              <EmptyDescription>Scanned appointment papers, contracts, and the PDS will be listed here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Document</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const kind = KIND[doc.kind]
                const Icon = kind.icon
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted">
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{kind.label}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDate(doc.uploadedAt)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{formatSize(doc.sizeKb)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
