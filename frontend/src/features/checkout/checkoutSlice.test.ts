import { describe, expect, it, beforeEach } from 'vitest'

import checkoutReducer, {
  initialCheckoutState,
  loadCheckoutState,
  persistCheckoutState,
  saveCustomerEmail,
  saveDeliveryDraft,
  savePaymentDraft,
  saveTransactionDraft,
  selectProduct,
} from './checkoutSlice'

const transaction = {
  idempotencyKey: 'cdc20b2f-6a24-4c98-a610-0821fd7797f7',
  transactionId: 'b9bb7362-91f7-4e62-9805-16c61e0de393',
  transactionReference: 'pay-123',
}

describe('checkout slice', () => {
  beforeEach(() => window.localStorage.clear())

  it('clears a pending transaction when checkout details change', () => {
    const withTransaction = checkoutReducer(initialCheckoutState, saveTransactionDraft(transaction))
    const withProduct = checkoutReducer(withTransaction, selectProduct('product-1'))
    const withDelivery = checkoutReducer(withProduct, saveDeliveryDraft({
      recipientName: 'Ana Pérez',
      phone: '3001234567',
      addressLine1: 'Calle 10',
      city: 'Bogotá',
      department: 'Bogotá D.C.',
    }))
    const withEmail = checkoutReducer(withDelivery, saveCustomerEmail('ana@example.com'))
    const withPayment = checkoutReducer(withEmail, savePaymentDraft({ cardBrand: 'VISA', cardLastFour: '4242' }))

    expect(withPayment.transaction).toEqual({
      idempotencyKey: null,
      transactionId: null,
      transactionReference: null,
    })
  })

  it('keeps a transaction when the selected product does not change', () => {
    const state = checkoutReducer(
      checkoutReducer(initialCheckoutState, selectProduct('product-1')),
      saveTransactionDraft(transaction),
    )

    expect(checkoutReducer(state, selectProduct('product-1')).transaction).toEqual(transaction)
  })

  it('restores only valid and safe persisted checkout data', () => {
    window.localStorage.setItem('payment-checkout/draft-v1', JSON.stringify({
      currentStep: 'summary',
      selectedProductId: 'product-1',
      delivery: { recipientName: 'Ana', phone: '3001234567', addressLine1: 'Calle 10', city: 'Bogotá', department: 'Bogotá D.C.' },
      customerEmail: 'ana@example.com',
      payment: { cardBrand: 'VISA', cardLastFour: '4242', token: 'must-not-be-restored' },
      transaction,
    }))

    expect(loadCheckoutState()).toEqual({
      currentStep: 'summary',
      selectedProductId: 'product-1',
      delivery: { recipientName: 'Ana', phone: '3001234567', addressLine1: 'Calle 10', city: 'Bogotá', department: 'Bogotá D.C.' },
      customerEmail: 'ana@example.com',
      payment: { cardBrand: 'VISA', cardLastFour: '4242' },
      transaction,
    })
  })

  it('persists a serializable draft without extra payment fields', () => {
    const state = checkoutReducer(initialCheckoutState, savePaymentDraft({ cardBrand: 'MASTERCARD', cardLastFour: '4444' }))
    persistCheckoutState(state)

    expect(JSON.parse(window.localStorage.getItem('payment-checkout/draft-v1') ?? '{}')).toEqual(state)
  })
})
