"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useHydrated } from "@/hooks/use-hydrated"
import { useSessionStore } from "@/stores/session-store"
import { BrandMark } from "@/components/brand"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

import { AppSidebar } from "./app-sidebar"
import { Topbar } from "./topbar"

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh" aria-busy="true" aria-label="Loading PayGrade">
      <div className="hidden w-64 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center gap-2 p-1">
          <BrandMark />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-8 w-64" />
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-72 md:col-span-4" />
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated()
  const user = useSessionStore((s) => s.user)
  const router = useRouter()

  useEffect(() => {
    if (hydrated && !user) router.replace("/login")
  }, [hydrated, user, router])

  if (!hydrated || !user) return <ShellSkeleton />

  return (
    // Collapse to icons on tablet widths. Safe to read window here: the shell only renders after hydration.
    <SidebarProvider defaultOpen={window.innerWidth >= 1024}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Topbar />
        <main id="main" className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
