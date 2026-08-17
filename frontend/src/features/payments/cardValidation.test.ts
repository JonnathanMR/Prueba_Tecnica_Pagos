import { describe, expect, it } from 'vitest'

import {
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidExpiry,
  isValidLuhn,
} from './cardValidation'

describe('card validation', () => {
  it('formats card values without retaining non-numeric characters', () => {
    expect(digitsOnly('4242-4242 4242.4242')).toBe('4242424242424242')
    expect(formatCardNumber('4242-4242 4242.4242')).toBe('4242 4242 4242 4242')
    expect(formatExpiry('1230')).toBe('12/30')
  })

  it('recognizes Visa and both Mastercard ranges', () => {
    expect(detectCardBrand('4242 4242 4242 4242')).toBe('VISA')
    expect(detectCardBrand('5555 5555 5555 4444')).toBe('MASTERCARD')
    expect(detectCardBrand('2221 0000 0000 0009')).toBe('MASTERCARD')
    expect(detectCardBrand('6011 1111 1111 1117')).toBe('UNKNOWN')
  })

  it('uses Luhn and the current month to reject invalid card data', () => {
    expect(isValidLuhn('4242 4242 4242 4242')).toBe(true)
    expect(isValidLuhn('4242 4242 4242 4243')).toBe(false)
    expect(isValidLuhn('4242')).toBe(false)

    const now = new Date(2026, 7, 16)
    expect(isValidExpiry('08/26', now)).toBe(true)
    expect(isValidExpiry('07/26', now)).toBe(false)
    expect(isValidExpiry('13/26', now)).toBe(false)
  })
})
