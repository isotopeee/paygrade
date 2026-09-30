"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Signatory } from "@/types"
import { useDataStore } from "@/stores/data-store"
import { SignatureBlock } from "@/components/reports/signature-block"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { LockNote, TabIntro } from "./settings-shared"

const schema = z.object({
  label: z.string().trim().min(3, "Enter the label printed on forms"),
  name: z.string().trim().min(3, "Enter the signatory's full name"),
  position: z.string().trim().min(2, "Enter the position title"),
})

type FormValues = z.infer<typeof schema>

function SignatoryForm({ signatory, onDone }: { signatory: Signatory; onDone: () => void }) {
  const update = useDataStore((s) => s.updateSignatory)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: signatory.label, name: signatory.name, position: signatory.position },
  })
  const errors = form.formState.errors
  const [name, position] = useWatch({ control: form.control, name: ["name", "position"] })

  const submit = form.handleSubmit((v) => {
    update({ ...signatory, ...v })
    toast.success("Signatory updated", { description: `${v.label}: ${v.name}` })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.label}>
          <FieldLabel htmlFor="sig-label">Label</FieldLabel>
          <Input id="sig-label" aria-invalid={!!errors.label} {...form.register("label")} />
          <FieldError errors={[errors.label]} />
        </Field>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="sig-name">Name</FieldLabel>
          <Input id="sig-name" aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.position}>
          <FieldLabel htmlFor="sig-position">Position</FieldLabel>
          <Input id="sig-position" aria-invalid={!!errors.position} {...form.register("position")} />
          <FieldError errors={[errors.position]} />
        </Field>
      </FieldGroup>
      <div className="rounded-lg border bg-muted/30 px-4 pb-4" aria-label="Signature block preview">
        <SignatureBlock name={name} position={position} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save changes</Button>
      </DialogFooter>
    </form>
  )
}

export function SignatoriesTab({ canManage }: { canManage: boolean }) {
  const signatories = useDataStore((s) => s.signatories)
  const [editing, setEditing] = useState<Signatory | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <TabIntro
        title="Signatories"
        description="Names and positions printed on the General Payroll, payroll register, payslips, and BIR Form 2316."
        actions={canManage ? undefined : <LockNote />}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {signatories.map((s) => (
          <Card key={s.id} size="sm">
            <CardHeader>
              <CardDescription className="text-xs">{s.label}</CardDescription>
              <CardTitle>{s.name}</CardTitle>
              {canManage && (
                <CardAction>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.label} signatory`}>
                    <PencilIcon />
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.position}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signature block preview</CardTitle>
          <CardDescription>As printed at the bottom of payroll forms.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 rounded-lg border bg-background p-4 sm:grid-cols-2 lg:grid-cols-5">
            {signatories.map((s) => (
              <div key={s.id} className="flex flex-col">
                <span className="text-xs text-muted-foreground">{s.label}:</span>
                <SignatureBlock name={s.name} position={s.position} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit signatory</DialogTitle>
            <DialogDescription>{editing?.label}</DialogDescription>
          </DialogHeader>
          {editing && <SignatoryForm key={editing.id} signatory={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
