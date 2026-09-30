"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronsUpDownIcon, LogOutIcon, RotateCcwIcon, UserCogIcon } from "lucide-react"
import { toast } from "sonner"

import type { Role } from "@/types"
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants"
import { useDataStore } from "@/stores/data-store"
import { useSessionStore } from "@/stores/session-store"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLES: Role[] = ["hr", "accountant", "chief", "cashier", "admin"]

export function useSwitchRole() {
  const users = useDataStore((s) => s.users)
  const logAudit = useDataStore((s) => s.logAudit)
  const signIn = useSessionStore((s) => s.signIn)
  return (role: Role) => {
    const user = users.find((u) => u.role === role && u.active)
    if (!user) {
      toast.error(`No active user is assigned the ${ROLE_LABELS[role]} role.`)
      return
    }
    signIn(user)
    logAudit({
      action: `Switched role to ${ROLE_LABELS[role]}`,
      entity: "session",
      entityId: user.id,
      entityLabel: user.name,
    })
    toast.success(`Now signed in as ${user.name}`, { description: ROLE_LABELS[role] })
  }
}

export function UserMenu() {
  const router = useRouter()
  const user = useSessionStore((s) => s.user)
  const signOut = useSessionStore((s) => s.signOut)
  const resetDemo = useDataStore((s) => s.resetDemo)
  const switchRole = useSwitchRole()
  const [confirmReset, setConfirmReset] = useState(false)

  if (!user) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" className="h-9 gap-2 px-1.5 data-popup-open:bg-muted" aria-label="Open user menu" />}
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-foreground text-[10px] font-medium text-background">{user.initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight lg:grid">
            <span className="max-w-40 truncate text-xs font-medium">{user.name}</span>
            <span className="max-w-40 truncate text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </div>
          <ChevronsUpDownIcon className="hidden text-muted-foreground lg:block" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-foreground">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{user.position}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserCogIcon aria-hidden />
              Switch role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Mock roles for the prototype</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={user.role} onValueChange={(value) => switchRole(value as Role)}>
                  {ROLES.map((role) => (
                    <DropdownMenuRadioItem key={role} value={role} className="items-start">
                      <div className="grid gap-0.5">
                        <span>{ROLE_LABELS[role]}</span>
                        <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => setConfirmReset(true)}>
            <RotateCcwIcon aria-hidden />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              signOut()
              router.push("/login")
            }}
          >
            <LogOutIcon aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              All changes made in this browser (new runs, adjustments, approvals, edits to employees and settings)
              will be discarded and the original seed data restored. Your current role stays the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetDemo()
                setConfirmReset(false)
                toast.success("Demo data restored to the original seed")
                router.push("/dashboard")
              }}
            >
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
