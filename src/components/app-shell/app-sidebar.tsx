"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { HOSPITAL } from "@/lib/constants"
import { NAV } from "@/lib/nav"
import { pendingForRole } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { BrandMark, BrandWordmark } from "@/components/brand"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()
  const role = useRole()
  const runs = useDataStore((s) => s.runs)

  const badges = useMemo(() => {
    if (!role) return {}
    const pending = pendingForRole(runs, role)
    return {
      "/payroll": pending.filter((r) => r.type === "regular").length,
      "/special-payroll": pending.filter((r) => r.type === "special").length,
    } as Record<string, number>
  }, [runs, role])

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} tooltip="PayGrade">
              <BrandMark />
              <div className="grid flex-1 text-left leading-tight">
                <BrandWordmark className="text-sm" />
                <span className="truncate text-xs text-muted-foreground">{HOSPITAL.short} Payroll</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const badge = badges[item.href]
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.title}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon aria-hidden />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {badge ? (
                        <SidebarMenuBadge
                          className="rounded-full bg-foreground px-1.5 text-background peer-data-active/menu-button:text-background"
                          aria-label={`${badge} awaiting your action`}
                        >
                          {badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="rounded-lg border border-dashed px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          UI prototype with mock data. Figures are for workflow validation only.
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
