"use client"

import { Suspense } from "react"

import { EmployeeDtr } from "@/components/attendance/employee-dtr"

export default function EmployeeDtrPage() {
  return (
    <Suspense fallback={null}>
      <EmployeeDtr />
    </Suspense>
  )
}
