"use client"

import { useEffect, useState } from "react"

import { useDataStore } from "@/stores/data-store"
import { useSessionStore } from "@/stores/session-store"

let hydration: Promise<void> | null = null
let hydrated = false

function hydrateStores(): Promise<void> {
  hydration ??= Promise.all([
    useSessionStore.persist.rehydrate(),
    useDataStore.persist.rehydrate(),
  ]).then(() => {
    hydrated = true
  })
  return hydration
}

/**
 * Rehydrates the persisted zustand stores once per page load. Returns false on
 * the server and during the first client render, so markup always matches.
 */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(hydrated)
  useEffect(() => {
    let active = true
    void hydrateStores().then(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [])
  return ready
}
