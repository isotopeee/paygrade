"use client"

import { useMemo } from "react"

import type { Employee, RatesConfig, SalarySchedule } from "@/types"
import { groupOf } from "@/lib/constants"
import { scheduleForDate, monthlyRateOn } from "@/lib/payroll/engine"
import { ratesForDate } from "@/lib/payroll/rates"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"

export interface EmployeeRates {
  rates: RatesConfig
  schedule: SalarySchedule
  /** Monthly basic (plantilla) or monthly equivalent (JO/COS) as of the demo date. */
  monthlyRate: number
  plantilla: boolean
}

/** Rates, salary schedule, and monthly rate in force for an employee on the demo date. */
export function useEmployeeRates(employee: Employee): EmployeeRates {
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  return useMemo(
    () => ({
      rates: ratesForDate(ratesVersions, DEMO_TODAY),
      schedule: scheduleForDate(salarySchedules, DEMO_TODAY),
      monthlyRate: monthlyRateOn({ salarySchedules, ratesVersions }, employee, DEMO_TODAY),
      plantilla: groupOf(employee.employmentType) === "plantilla",
    }),
    [salarySchedules, ratesVersions, employee]
  )
}
