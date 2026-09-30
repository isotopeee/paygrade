"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { AppUser, Role } from "@/types"
import { SEED_USERS } from "@/data/reference"

interface SessionState {
  user: AppUser | null
  signIn: (user: AppUser) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    {
      name: "paygrade-session",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
)

/** Active role, or undefined before sign-in. */
export function useRole(): Role | undefined {
  return useSessionStore((s) => s.user?.role)
}

export function useCurrentUser(): AppUser | null {
  return useSessionStore((s) => s.user)
}

/** Current actor for audit entries. Falls back to the HR user outside a session. */
export function currentActor(): { name: string; role: Role } {
  const user = useSessionStore.getState().user ?? SEED_USERS[0]
  return { name: user?.name ?? "System", role: user?.role ?? "admin" }
}
