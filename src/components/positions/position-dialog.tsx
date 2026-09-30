"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Position } from "@/types"
import { DEMO_TODAY } from "@/data/seed"
import { useDataStore, uid } from "@/stores/data-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const ITEM_NO_PATTERN = /^MMWGH-[A-Z0-9]{2,10}-\d{6}-\d{4}$/
const DEFAULT_AUTHORIZATION = "DBM Notice of Organization, Staffing, and Compensation Action"

function buildSchema(takenItemNos: ReadonlySet<string>) {
  return z.object({
    itemNo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(ITEM_NO_PATTERN, "Use the format MMWGH-CODE-######-YYYY, for example MMWGH-NURS1-000309-2026")
      .refine((v) => !takenItemNos.has(v), "This item number is already in the plantilla"),
    title: z.string().trim().min(3, "Enter the position title").max(80),
    salaryGrade: z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter a whole number")
      .refine((v) => Number(v) >= 1 && Number(v) <= 33, "Salary grade must be from 1 to 33"),
    departmentId: z.string().min(1, "Select a department"),
    authorization: z.string().trim().min(5, "Enter the authority that created the item").max(120),
  })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

export function nextItemSequence(positions: readonly Position[]): string {
  let max = 0
  for (const p of positions) {
    const seq = Number(p.itemNo.split("-")[2] ?? 0)
    if (Number.isFinite(seq) && seq > max) max = seq
  }
  return String(max + 1).padStart(6, "0")
}

export function PositionDialog({
  open,
  onOpenChange,
  position,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Position to edit. Omit to create a new item. */
  position?: Position
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{position ? "Edit plantilla position" : "Create plantilla position"}</DialogTitle>
          <DialogDescription>
            {position
              ? "Update the details of this plantilla item. The incumbent is unchanged."
              : "Add a new plantilla item. It starts vacant until an appointment is issued."}
          </DialogDescription>
        </DialogHeader>
        <PositionForm position={position} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PositionForm({ position, onDone }: { position?: Position; onDone: () => void }) {
  const positions = useDataStore((s) => s.positions)
  const departments = useDataStore((s) => s.departments)
  const upsertPosition = useDataStore((s) => s.upsertPosition)

  const taken = new Set(positions.filter((p) => p.id !== position?.id).map((p) => p.itemNo.toUpperCase()))
  const example = `MMWGH-NURS1-${nextItemSequence(positions)}-${DEMO_TODAY.slice(0, 4)}`

  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(taken)),
    defaultValues: {
      itemNo: position?.itemNo ?? "",
      title: position?.title ?? "",
      salaryGrade: position ? String(position.salaryGrade) : "",
      departmentId: position?.departmentId ?? "",
      authorization: position?.authorization ?? DEFAULT_AUTHORIZATION,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    const next: Position = {
      id: position?.id ?? uid("pos"),
      itemNo: values.itemNo,
      title: values.title,
      salaryGrade: Number(values.salaryGrade),
      departmentId: values.departmentId,
      employeeId: position?.employeeId,
      dateCreated: position?.dateCreated ?? DEMO_TODAY,
      authorization: values.authorization,
    }
    upsertPosition(next)
    toast.success(position ? "Position updated" : "Position created", {
      description: `${next.itemNo}, ${next.title} (SG ${next.salaryGrade})`,
    })
    onDone()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.itemNo}>
          <FieldLabel htmlFor="position-item-no">Item number</FieldLabel>
          <Input
            id="position-item-no"
            className="font-mono uppercase"
            placeholder={example}
            autoComplete="off"
            aria-invalid={!!errors.itemNo}
            {...form.register("itemNo")}
          />
          <FieldDescription>Format MMWGH-CODE-######-YYYY. Next free sequence: {example}</FieldDescription>
          <FieldError errors={[errors.itemNo]} />
        </Field>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="position-title">Position title</FieldLabel>
          <Input id="position-title" placeholder="Nurse I" aria-invalid={!!errors.title} {...form.register("title")} />
          <FieldError errors={[errors.title]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field data-invalid={!!errors.salaryGrade}>
            <FieldLabel htmlFor="position-sg">Salary grade</FieldLabel>
            <Input
              id="position-sg"
              inputMode="numeric"
              placeholder="15"
              className="tabular-nums"
              aria-invalid={!!errors.salaryGrade}
              {...form.register("salaryGrade")}
            />
            <FieldError errors={[errors.salaryGrade]} />
          </Field>
          <Field data-invalid={!!errors.departmentId}>
            <FieldLabel htmlFor="position-dept">Department</FieldLabel>
            <NativeSelect
              id="position-dept"
              className="w-full"
              aria-invalid={!!errors.departmentId}
              {...form.register("departmentId")}
            >
              <NativeSelectOption value="">Select a department</NativeSelectOption>
              {departments.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.departmentId]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.authorization}>
          <FieldLabel htmlFor="position-auth">Authorization</FieldLabel>
          <Input id="position-auth" aria-invalid={!!errors.authorization} {...form.register("authorization")} />
          <FieldError errors={[errors.authorization]} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{position ? "Save changes" : "Create position"}</Button>
      </DialogFooter>
    </form>
  )
}
