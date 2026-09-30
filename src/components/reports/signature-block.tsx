import { cn } from "@/lib/utils"

/** Signature block as printed on payroll forms: name in caps above a line, position below. */
export function SignatureBlock({
  name,
  position,
  className,
}: {
  name: string
  position: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-0.5 pt-8 text-center", className)}>
      <div className="w-full max-w-64 border-b border-foreground pb-0.5 text-sm font-semibold tracking-wide uppercase">
        {name || " "}
      </div>
      <div className="text-xs text-muted-foreground">{position}</div>
    </div>
  )
}

/** Lettered certification box used below the General Payroll. */
export function CertificationBox({
  letter,
  statement,
  name,
  position,
}: {
  letter: string
  statement: string
  name: string
  position: string
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border p-3">
      <div className="flex gap-2 text-xs">
        <span className="flex size-5 shrink-0 items-center justify-center rounded border font-semibold">{letter}</span>
        <p className="leading-relaxed">{statement}</p>
      </div>
      <SignatureBlock name={name} position={position} />
      <div className="mt-2 text-center text-[0.6875rem] text-muted-foreground">Date: ____________</div>
    </div>
  )
}
