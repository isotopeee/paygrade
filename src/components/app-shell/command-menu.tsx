"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BanknoteIcon, GiftIcon, MoonIcon, PlusIcon, SearchIcon, UserIcon, UserCogIcon } from "lucide-react"
import { useTheme } from "next-themes"

import type { Role } from "@/types"
import { EMPLOYMENT_TYPE_SHORT, ROLE_LABELS } from "@/lib/constants"
import { formatPeriod, fullName } from "@/lib/format"
import { NAV_ITEMS } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { RunStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Command } from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

import { useSwitchRole } from "./user-menu"

export function CommandMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const role = useRole()
  const employees = useDataStore((s) => s.employees)
  const runs = useDataStore((s) => s.runs)
  const { resolvedTheme, setTheme } = useTheme()
  const switchRole = useSwitchRole()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const recentRuns = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 w-full max-w-72 justify-start gap-2 bg-muted/40 px-2.5 text-muted-foreground shadow-none sm:w-48 lg:w-64"
        aria-label="Search pages, employees, and payroll runs"
      >
        <SearchIcon aria-hidden />
        <span className="flex-1 truncate text-left font-normal">Search</span>
        <KbdGroup className="hidden sm:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global search"
        description="Search pages, employees, payroll runs, and actions"
      >
        <Command>
          <CommandInput placeholder="Search employees, payroll runs, pages, or actions" />
          <CommandList className="max-h-[60svh]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              {can(role, "payroll.create") && (
                <CommandItem value="create payroll run new regular" onSelect={() => go("/payroll/new")}>
                  <PlusIcon aria-hidden />
                  Create payroll run
                </CommandItem>
              )}
              {can(role, "payroll.create") && (
                <CommandItem value="create special payroll bonus" onSelect={() => go("/special-payroll?create=1")}>
                  <GiftIcon aria-hidden />
                  Create special payroll
                </CommandItem>
              )}
              <CommandItem
                value="toggle theme dark light mode"
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  setOpen(false)
                }}
              >
                <MoonIcon aria-hidden />
                Toggle dark mode
                <CommandShortcut>D</CommandShortcut>
              </CommandItem>
              {(["hr", "accountant", "chief", "cashier", "admin"] as Role[])
                .filter((r) => r !== role)
                .map((r) => (
                  <CommandItem
                    key={r}
                    value={`switch role ${ROLE_LABELS[r]}`}
                    onSelect={() => {
                      switchRole(r)
                      setOpen(false)
                    }}
                  >
                    <UserCogIcon aria-hidden />
                    Switch role to {ROLE_LABELS[r]}
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {NAV_ITEMS.map((item) => (
                <CommandItem key={item.href} value={`${item.title} ${item.keywords ?? ""}`} onSelect={() => go(item.href)}>
                  <item.icon aria-hidden />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Employees">
              {employees.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${fullName(e)} ${e.employeeNo} ${e.positionTitle}`}
                  onSelect={() => go(`/employees/${e.id}`)}
                >
                  <UserIcon aria-hidden />
                  <span className="truncate">{fullName(e)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {e.positionTitle}, {EMPLOYMENT_TYPE_SHORT[e.employmentType]}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{e.employeeNo}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Payroll runs">
              {recentRuns.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.code} ${r.title} ${formatPeriod(r.periodStart, r.periodEnd)}`}
                  onSelect={() => go(r.type === "special" ? `/special-payroll/${r.id}` : `/payroll/${r.id}`)}
                >
                  <BanknoteIcon aria-hidden />
                  <span className="truncate">
                    {r.type === "regular" ? formatPeriod(r.periodStart, r.periodEnd) : r.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{r.type === "regular" ? r.title : r.code}</span>
                  <span className="ml-auto">
                    <RunStatusBadge status={r.status} />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
