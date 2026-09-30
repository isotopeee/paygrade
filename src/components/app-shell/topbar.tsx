"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, useMemo } from "react"

import { fullName } from "@/lib/format"
import { SEGMENT_LABELS } from "@/lib/nav"
import { useDataStore } from "@/stores/data-store"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { CommandMenu } from "./command-menu"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"

function useBreadcrumbs() {
  const pathname = usePathname()
  const employees = useDataStore((s) => s.employees)
  const runs = useDataStore((s) => s.runs)
  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    return segments.map((segment, i) => {
      const href = `/${segments.slice(0, i + 1).join("/")}`
      let label = SEGMENT_LABELS[segment]
      if (!label) {
        const employee = employees.find((e) => e.id === segment)
        const run = runs.find((r) => r.id === segment)
        label = employee ? fullName(employee) : run ? run.code : decodeURIComponent(segment)
      }
      return { href, label }
    })
  }, [pathname, employees, runs])
}

export function Topbar() {
  const crumbs = useBreadcrumbs()
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden md:px-4">
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Breadcrumb className="hidden min-w-0 flex-1 md:block">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => (
            <Fragment key={c.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={c.href} />} className="truncate">
                    {c.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 md:flex-none">
        <CommandMenu />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <UserMenu />
      </div>
    </header>
  )
}
