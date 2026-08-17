import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createTransaction,
  getAcceptanceData,
  getTransaction,
  processPayment,
  tokenizeCard,
} from './checkoutApi'

const transaction = {
  id: 'transaction-1',
  reference: 'pay-123',
  status: 'PENDING' as const,
  amounts: { productInCents: 8_990_000, baseFeeInCents: 150_000, shippingFeeInCents: 500_000, totalInCents: 9_640_000 },
  paymentMethod: null,
  failure: { code: null, message: null },
  delivery: { status: 'PENDING', city: 'Bogotá', department: 'Bogotá D.C.' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('checkout API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests acceptance data and tokenizes a supported card', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: {
        acceptanceToken: 'acceptance-token',
        acceptancePermalink: 'https://example.test/terms',
        personalDataAuthToken: 'personal-token',
        personalDataAuthPermalink: 'https://example.test/data',
      } }))
      .mockResolvedValueOnce(jsonResponse({ data: { token: 'tok_test', brand: 'VISA', lastFour: '4242' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAcceptanceData()).resolves.toMatchObject({ acceptanceToken: 'acceptance-token' })
    await expect(tokenizeCard({ number: '4242424242424242', cvc: '123', expMonth: '12', expYear: '30', cardHolder: 'Ana Pérez' }))
      .resolves.toEqual({ token: 'tok_test', brand: 'VISA', lastFour: '4242' })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/checkout/acceptance-data', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/checkout/cards/tokenize', expect.objectContaining({ method: 'POST' }))
  })

  it('creates, processes and retrieves a transaction with the expected requests', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ data: transaction })))
    vi.stubGlobal('fetch', fetchMock)
    const createInput = {
      productId: 'product-1',
      idempotencyKey: 'key-1',
      baseFeeInCents: 150_000,
      shippingFeeInCents: 500_000,
      customer: { fullName: 'Ana Pérez', email: 'ana@example.com', phone: '3001234567' },
      delivery: { recipientName: 'Ana Pérez', recipientPhone: '3001234567', addressLine1: 'Calle 10', city: 'Bogotá', department: 'Bogotá D.C.', country: 'CO' as const },
    }

    await expect(createTransaction(createInput)).resolves.toEqual(transaction)
    await expect(processPayment({ transactionId: 'transaction/1', cardToken: 'tok_test', cardBrand: 'VISA', cardLastFour: '4242', acceptanceToken: 'terms', acceptPersonalAuth: 'data' })).resolves.toEqual(transaction)
    await expect(getTransaction('transaction/1')).resolves.toEqual(transaction)

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/checkout/transactions', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/checkout/transactions/transaction%2F1/payments', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"installments":1') }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/checkout/transactions/transaction%2F1', expect.objectContaining({ cache: 'no-store' }))
  })

  it('surfaces API and malformed-response failures without exposing payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: { message: 'Tarjeta rechazada' } }, 422)))
    await expect(getAcceptanceData()).rejects.toThrow('Tarjeta rechazada')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({})))
    await expect(getAcceptanceData()).rejects.toThrow('La respuesta del servidor no tiene el formato esperado.')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ data: { token: 'tok_test', brand: 'UNKNOWN', lastFour: '42' } })))
    await expect(tokenizeCard({ number: '4242424242424242', cvc: '123', expMonth: '12', expYear: '30', cardHolder: 'Ana Pérez' }))
      .rejects.toThrow('La pasarela no pudo validar la franquicia de la tarjeta.')
  })
})
