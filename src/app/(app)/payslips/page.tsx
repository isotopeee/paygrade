"use client"

import { Suspense } from "react"

import { PayslipsView } from "@/components/payslips/payslips-view"

export default function PayslipsPage() {
  return (
    <Suspense>
      <PayslipsView />
    </Suspense>
  )
}
