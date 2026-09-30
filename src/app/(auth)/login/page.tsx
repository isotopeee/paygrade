"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRightIcon, LockKeyholeIcon } from "lucide-react"

import type { Role } from "@/types"
import { HOSPITAL, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants"
import { useHydrated } from "@/hooks/use-hydrated"
import { useDataStore } from "@/stores/data-store"
import { useSessionStore } from "@/stores/session-store"
import { BrandMark, BrandWordmark } from "@/components/brand"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const ROLES: Role[] = ["hr", "accountant", "chief", "cashier", "admin"]

export default function LoginPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const users = useDataStore((s) => s.users)
  const signIn = useSessionStore((s) => s.signIn)
  const logAudit = useDataStore((s) => s.logAudit)
  const [role, setRole] = useState<Role>("hr")
  const [pending, setPending] = useState(false)

  const user = users.find((u) => u.role === role && u.active)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setPending(true)
    signIn(user)
    logAudit({ action: "Signed in", entity: "session", entityId: user.id, entityLabel: user.name })
    router.push("/dashboard")
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="bg-background text-foreground" />
          <BrandWordmark className="text-lg" />
        </div>
        <div className="max-w-md space-y-4">
          <p className="text-xs font-medium tracking-widest text-background/60 uppercase">{HOSPITAL.agency}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{HOSPITAL.name}</h1>
          <p className="text-sm text-background/70">
            Payroll for plantilla, casual, contractual, Job Order, and Contract of Service personnel. Salary
            Standardization, GSIS, PhilHealth, Pag-IBIG, BIR withholding, and Magna Carta benefits in one workflow.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 border-t border-background/15 pt-6 text-sm">
          <div>
            <dt className="text-background/60">Workflow</dt>
            <dd className="mt-1 font-medium">Draft to Released</dd>
          </div>
          <div>
            <dt className="text-background/60">Payroll cycle</dt>
            <dd className="mt-1 font-medium">Monthly</dd>
          </div>
          <div>
            <dt className="text-background/60">Location</dt>
            <dd className="mt-1 font-medium">Mariveles, Bataan</dd>
          </div>
        </dl>
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] text-background/5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <rect x="3" y="13" width="4.5" height="8" rx="1" />
          <rect x="9.75" y="8" width="4.5" height="13" rx="1" />
          <rect x="16.5" y="3" width="4.5" height="18" rx="1" />
        </svg>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <BrandMark />
            <BrandWordmark />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-10">
          <form onSubmit={submit} className="w-full max-w-md space-y-6">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground lg:hidden">{HOSPITAL.name}</p>
              <h2 className="text-2xl font-semibold tracking-tight">Sign in to PayGrade</h2>
              <p className="text-sm text-muted-foreground">
                Choose a role to explore the prototype. You can switch roles later from the user menu.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Role</legend>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="gap-1.5">
                {ROLES.map((r) => {
                  const u = users.find((x) => x.role === r && x.active)
                  return (
                    <FieldLabel key={r} htmlFor={`role-${r}`}>
                      <Field orientation="horizontal">
                        <RadioGroupItem value={r} id={`role-${r}`} />
                        <FieldContent>
                          <FieldTitle className="w-full justify-between">
                            <span>{ROLE_LABELS[r]}</span>
                            {hydrated && u && <span className="text-xs font-normal text-muted-foreground">{u.name}</span>}
                          </FieldTitle>
                          <FieldDescription className="text-xs">{ROLE_DESCRIPTIONS[r]}</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  )
                })}
              </RadioGroup>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" value={hydrated ? (user?.email ?? "") : ""} readOnly className="font-mono text-xs" />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LockKeyholeIcon className="size-3.5" aria-hidden />
                Mock sign-in. No password is required in the prototype.
              </p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!hydrated || !user || pending}>
              Continue as {ROLE_LABELS[role]}
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          </form>
        </div>
        <footer className="p-4 text-center text-xs text-muted-foreground">
          {HOSPITAL.short} Human Resource Management Office and Accounting Section
        </footer>
      </main>
    </div>
  )
}
