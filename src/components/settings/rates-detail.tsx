"use client"

import type { RatesConfig, TaxBracket } from "@/types"
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/format"
import { InfoGrid } from "@/components/info-grid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function BracketTable({ rows, caption }: { rows: readonly TaxBracket[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label={caption}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-right text-xs">Over</TableHead>
            <TableHead className="text-right text-xs">Not over</TableHead>
            <TableHead className="text-right text-xs">Base tax</TableHead>
            <TableHead className="text-right text-xs">Rate on excess</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.over}>
              <TableCell className="text-right tabular-nums">{formatCurrency(b.over)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {b.upTo === null ? <span className="text-muted-foreground">No limit</span> : formatCurrency(b.upTo)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(b.baseTax)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(b.rate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function RatesDetail({ rates }: { rates: RatesConfig }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Version">
        <InfoGrid
          columns={4}
          items={[
            { label: "Label", value: rates.label },
            { label: "Effectivity", value: formatDate(rates.effectivityDate) },
            { label: "Created by", value: rates.createdBy },
            { label: "Created", value: formatDateTime(rates.createdAt) },
            { label: "Legal basis", value: <span className="whitespace-normal">{rates.legalBasis}</span>, span: 3 },
          ]}
        />
      </Section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="GSIS" description="Life and retirement premiums (RA 8291) and ECC.">
          <InfoGrid
            columns={2}
            className="lg:grid-cols-2"
            items={[
              { label: "Personal share", value: formatPercent(rates.gsis.personalRate) },
              { label: "Government share", value: formatPercent(rates.gsis.governmentRate) },
              { label: "ECC per month", value: formatCurrency(rates.gsis.eccMonthly) },
            ]}
          />
        </Section>
        <Section title="PhilHealth" description="Premium on monthly basic salary.">
          <InfoGrid
            columns={2}
            className="lg:grid-cols-2"
            items={[
              { label: "Premium rate", value: formatPercent(rates.philhealth.premiumRate) },
              { label: "Employee share of premium", value: formatPercent(rates.philhealth.employeeShare) },
              { label: "Salary floor", value: formatCurrency(rates.philhealth.floor) },
              { label: "Salary ceiling", value: formatCurrency(rates.philhealth.ceiling) },
            ]}
          />
        </Section>
        <Section title="Pag-IBIG" description="HDMF contributions on monthly compensation.">
          <InfoGrid
            columns={2}
            className="lg:grid-cols-2"
            items={[
              { label: "Employee rate (low income)", value: formatPercent(rates.pagibig.employeeRateLow) },
              { label: "Employee rate", value: formatPercent(rates.pagibig.employeeRate) },
              { label: "Employer rate", value: formatPercent(rates.pagibig.employerRate) },
              { label: "Low-income threshold", value: formatCurrency(rates.pagibig.lowIncomeThreshold) },
              { label: "Max fund salary", value: formatCurrency(rates.pagibig.maxFundSalary) },
            ]}
          />
        </Section>
      </div>

      <Section title="Withholding tax tables" description="BIR compensation withholding tables by payroll frequency.">
        <Tabs defaultValue="semiMonthly">
          <TabsList>
            <TabsTrigger value="semiMonthly">Semi-monthly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual</TabsTrigger>
          </TabsList>
          <TabsContent value="semiMonthly">
            <BracketTable rows={rates.withholding.semiMonthly} caption="Semi-monthly withholding tax table" />
          </TabsContent>
          <TabsContent value="monthly">
            <BracketTable rows={rates.withholding.monthly} caption="Monthly withholding tax table" />
          </TabsContent>
          <TabsContent value="annual">
            <BracketTable rows={rates.withholding.annual} caption="Annual withholding tax table" />
          </TabsContent>
        </Tabs>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Other rates">
          <InfoGrid
            columns={3}
            items={[
              { label: "PERA per month", value: formatCurrency(rates.peraMonthly) },
              { label: "Working days per month", value: rates.workingDaysPerMonth },
              { label: "Hours per day", value: rates.hoursPerDay },
              { label: "OT multiplier, regular day", value: `${rates.overtime.regularDayMultiplier}x` },
              { label: "OT multiplier, rest day", value: `${rates.overtime.restDayMultiplier}x` },
              { label: "Night differential rate", value: formatPercent(rates.nightDiff.rate) },
              { label: "Night differential up to", value: `SG ${rates.nightDiff.maxSalaryGrade}` },
              { label: "Minimum monthly net pay", value: formatCurrency(rates.minimumNetPayMonthly) },
              { label: "JO/COS withholding rate", value: formatPercent(rates.joCos.withholdingRate) },
            ]}
          />
        </Section>
        <Section title="Bonuses">
          <InfoGrid
            columns={2}
            className="lg:grid-cols-2"
            items={[
              { label: "Cash gift", value: formatCurrency(rates.bonuses.cashGift) },
              { label: "PEI", value: formatCurrency(rates.bonuses.pei) },
              { label: "Uniform allowance", value: formatCurrency(rates.bonuses.uniformAllowance) },
              { label: "Minimum months of service", value: rates.bonuses.minimumMonthsForBonus },
              { label: "13th month and other benefits exemption", value: formatCurrency(rates.bonuses.exemptionCeiling) },
              {
                label: "Leave monetization",
                value: `Retain ${rates.leaveMonetization.retainedDays} VL days, up to ${rates.leaveMonetization.maxDaysPerApplication} days per application`,
              },
            ]}
          />
        </Section>
      </div>

      <Section title="Magna Carta for Public Health Workers" description="RA 7305 benefits.">
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <InfoGrid
            columns={2}
            className="h-fit lg:grid-cols-2"
            items={[
              { label: "Subsistence per day", value: formatCurrency(rates.magnaCarta.subsistencePerDay) },
              { label: "Subsistence max days", value: rates.magnaCarta.subsistenceMaxDays },
              { label: "Laundry per month", value: formatCurrency(rates.magnaCarta.laundryMonthly) },
              {
                label: "Longevity pay",
                value: `${formatPercent(rates.magnaCarta.longevityRate)} per ${rates.magnaCarta.longevityYearsPerBlock} years`,
              },
            ]}
          />
          <div className="overflow-x-auto rounded-lg border">
            <Table aria-label="Hazard pay bands">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Hazard pay band</TableHead>
                  <TableHead className="text-right text-xs">Rate of monthly basic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.magnaCarta.hazardRates.map((h, i) => {
                  const from = i === 0 ? 1 : (rates.magnaCarta.hazardRates[i - 1]?.maxSalaryGrade ?? 0) + 1
                  return (
                    <TableRow key={h.maxSalaryGrade}>
                      <TableCell className="tabular-nums">
                        {from === h.maxSalaryGrade ? `SG ${from}` : `SG ${from} to ${h.maxSalaryGrade}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(h.rate)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </Section>
    </div>
  )
}
