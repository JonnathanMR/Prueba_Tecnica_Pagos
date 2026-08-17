import { describe, expect, it } from 'vitest'

import { baseFeeInCents, formatCop, shippingFeeInCents } from './checkoutCosts'

describe('checkout costs', () => {
  it('exposes checkout fees and formats Colombian pesos from cents', () => {
    expect(baseFeeInCents).toBe(1_500)
    expect(shippingFeeInCents).toBe(5_000)
    expect(formatCop(8_990_000)).toContain('89.900')
  })
})
