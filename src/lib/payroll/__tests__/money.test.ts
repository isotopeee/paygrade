import { describe, expect, it } from "vitest"

import { applyRate, clamp, pesos, prorate, sum, toPesos } from "../money"

describe("money helpers", () => {
  it("converts pesos to integer centavos without float drift", () => {
    expect(pesos(0.1) + pesos(0.2)).toBe(30)
    expect(pesos("1234.56")).toBe(123456)
    expect(pesos(1.005)).toBe(101) // half-up on the decimal representation
    expect(toPesos(123456)).toBe(1234.56)
  })

  it("applies rates with half-up rounding to the centavo", () => {
    expect(applyRate(12345, 0.05)).toBe(617) // 617.25
    expect(applyRate(50, 0.09)).toBe(5) // 4.5 rounds up
    expect(applyRate(pesos(30_000), 0.09)).toBe(pesos(2_700))
  })

  it("prorates with a single rounding step", () => {
    expect(prorate(pesos(22_000), 1, 22)).toBe(pesos(1_000))
    expect(prorate(pesos(10_000), 1, 3)).toBe(333333)
    expect(prorate(pesos(10_000), 1, 0)).toBe(0)
  })

  it("sums and clamps", () => {
    expect(sum([1, 2, 3])).toBe(6)
    expect(sum([])).toBe(0)
    expect(clamp(5, 10, 20)).toBe(10)
    expect(clamp(25, 10, 20)).toBe(20)
    expect(clamp(15, 10, 20)).toBe(15)
  })
})
