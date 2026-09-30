"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { formatCurrency, formatCurrencyCompact, formatPeriod } from "@/lib/format"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export interface TrendPoint {
  label: string
  start: string
  end: string
  /** Net pay in centavos per group. */
  plantilla: number
  jo_cos: number
}

// Monochrome system: two neutral inks, identity also carried by the legend and tooltip labels.
const config = {
  plantilla: { label: "Plantilla", color: "var(--foreground)" },
  jo_cos: { label: "JO/COS", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export function NetTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
        />
        <ChartTooltip
          cursor={{ fillOpacity: 0.5 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as TrendPoint | undefined
                return p ? formatPeriod(p.start, p.end) : ""
              }}
              formatter={(value, name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} aria-hidden />
                  <span className="text-muted-foreground">{config[name as keyof typeof config]?.label ?? name}</span>
                  <span className="ml-auto font-medium text-foreground tabular-nums">{formatCurrency(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="plantilla" stackId="net" fill="var(--color-plantilla)" stroke="var(--card)" strokeWidth={2} radius={[0, 0, 0, 0]} maxBarSize={28} />
        <Bar dataKey="jo_cos" stackId="net" fill="var(--color-jo_cos)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  )
}
