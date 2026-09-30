import Decimal from "decimal.js"

import type { Centavos } from "@/types"

/**
 * Money helpers. All amounts are integer centavos. Any operation involving a
 * rate or a division goes through decimal.js and is rounded half-up to the
 * nearest centavo, so there is no floating-point drift.
 */

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

function toInt(value: Decimal): Centavos {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

/** Convert a peso amount (number or string such as "1234.56") to centavos. */
export function pesos(amount: number | string): Centavos {
  return toInt(new D(amount).mul(100))
}

/** Convert centavos to a peso number. Use for display or charts only. */
export function toPesos(amount: Centavos): number {
  return new D(amount).div(100).toNumber()
}

/** Multiply an amount by a rate (for example 0.09) and round to the centavo. */
export function applyRate(amount: Centavos, rate: number | string): Centavos {
  return toInt(new D(amount).mul(rate))
}

/** amount * numerator / denominator, rounded once at the end. */
export function prorate(
  amount: Centavos,
  numerator: number,
  denominator: number
): Centavos {
  if (denominator === 0) return 0
  return toInt(new D(amount).mul(numerator).div(denominator))
}

/** Sum a list of centavo amounts. */
export function sum(values: readonly Centavos[]): Centavos {
  let total = 0
  for (const value of values) total += value
  return total
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => Centavos): Centavos {
  let total = 0
  for (const item of items) total += pick(item)
  return total
}

export function clamp(value: Centavos, min: Centavos, max: Centavos): Centavos {
  return Math.min(Math.max(value, min), max)
}
