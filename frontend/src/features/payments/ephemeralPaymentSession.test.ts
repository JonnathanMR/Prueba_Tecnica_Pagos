import { afterEach, describe, expect, it } from 'vitest'

import {
  clearEphemeralPaymentSession,
  getEphemeralPaymentSession,
  saveEphemeralPaymentSession,
} from './ephemeralPaymentSession'

describe('ephemeral payment session', () => {
  afterEach(() => clearEphemeralPaymentSession())

  it('keeps the card token only until the checkout flow clears it', () => {
    expect(getEphemeralPaymentSession()).toBeNull()
    saveEphemeralPaymentSession({ token: 'tok_test', brand: 'VISA', lastFour: '4242' })
    expect(getEphemeralPaymentSession()).toEqual({ token: 'tok_test', brand: 'VISA', lastFour: '4242' })

    clearEphemeralPaymentSession()
    expect(getEphemeralPaymentSession()).toBeNull()
  })
})
