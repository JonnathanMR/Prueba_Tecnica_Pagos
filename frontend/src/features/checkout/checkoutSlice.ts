import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

const storageKey = 'payment-checkout/draft-v1'

export const checkoutSteps = ['product', 'payment', 'summary', 'result'] as const
export type CheckoutStep = (typeof checkoutSteps)[number]

export interface DeliveryDraft {
  recipientName: string
  phone: string
  addressLine1: string
  city: string
  department: string
}

export type SafeCardBrand = 'VISA' | 'MASTERCARD'

export interface PaymentDraft {
  cardBrand: SafeCardBrand | null
  cardLastFour: string | null
}

export interface TransactionDraft {
  idempotencyKey: string | null
  transactionId: string | null
  transactionReference: string | null
}

export interface CheckoutState {
  currentStep: CheckoutStep
  selectedProductId: string | null
  delivery: DeliveryDraft
  customerEmail: string
  payment: PaymentDraft
  transaction: TransactionDraft
}

const emptyDeliveryDraft: DeliveryDraft = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  city: '',
  department: '',
}

const emptyPaymentDraft: PaymentDraft = {
  cardBrand: null,
  cardLastFour: null,
}

const emptyTransactionDraft: TransactionDraft = {
  idempotencyKey: null,
  transactionId: null,
  transactionReference: null,
}

export const initialCheckoutState: CheckoutState = {
  currentStep: 'product',
  selectedProductId: null,
  delivery: emptyDeliveryDraft,
  customerEmail: '',
  payment: emptyPaymentDraft,
  transaction: emptyTransactionDraft,
}

function isCheckoutStep(value: unknown): value is CheckoutStep {
  return typeof value === 'string' && checkoutSteps.includes(value as CheckoutStep)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function safeCardBrand(value: unknown): SafeCardBrand | null {
  return value === 'VISA' || value === 'MASTERCARD' ? value : null
}

function lastFour(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}$/.test(value) ? value : null
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function loadCheckoutState(): CheckoutState {
  if (typeof window === 'undefined') return initialCheckoutState

  try {
    const savedDraft: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (typeof savedDraft !== 'object' || savedDraft === null) return initialCheckoutState

    const draft = savedDraft as Partial<CheckoutState>
    const delivery =
      typeof draft.delivery === 'object' && draft.delivery !== null
        ? draft.delivery
        : emptyDeliveryDraft
    const payment =
      typeof draft.payment === 'object' && draft.payment !== null
        ? draft.payment
        : emptyPaymentDraft
    const transaction =
      typeof draft.transaction === 'object' && draft.transaction !== null
        ? draft.transaction
        : emptyTransactionDraft

    return {
      currentStep: isCheckoutStep(draft.currentStep)
        ? draft.currentStep
        : initialCheckoutState.currentStep,
      selectedProductId:
        typeof draft.selectedProductId === 'string' ? draft.selectedProductId : null,
      delivery: {
        recipientName: stringValue(delivery.recipientName),
        phone: stringValue(delivery.phone),
        addressLine1: stringValue(delivery.addressLine1),
        city: stringValue(delivery.city),
        department: stringValue(delivery.department),
      },
      customerEmail: stringValue(draft.customerEmail),
      payment: {
        cardBrand: safeCardBrand(payment.cardBrand),
        cardLastFour: lastFour(payment.cardLastFour),
      },
      transaction: {
        idempotencyKey: nullableString(transaction.idempotencyKey),
        transactionId: nullableString(transaction.transactionId),
        transactionReference: nullableString(transaction.transactionReference),
      },
    }
  } catch {
    return initialCheckoutState
  }
}

export function persistCheckoutState(state: CheckoutState): void {
  if (typeof window !== 'undefined') {
    const safeDraft: CheckoutState = {
      currentStep: state.currentStep,
      selectedProductId: state.selectedProductId,
      delivery: state.delivery,
      customerEmail: state.customerEmail,
      payment: state.payment,
      transaction: state.transaction,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(safeDraft))
  }
}

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckoutState,
  reducers: {
    moveToStep(state, action: PayloadAction<CheckoutStep>) {
      state.currentStep = action.payload
    },
    selectProduct(state, action: PayloadAction<string>) {
      if (state.selectedProductId !== action.payload) state.transaction = emptyTransactionDraft
      state.selectedProductId = action.payload
    },
    saveDeliveryDraft(state, action: PayloadAction<DeliveryDraft>) {
      state.delivery = action.payload
      state.transaction = emptyTransactionDraft
    },
    saveCustomerEmail(state, action: PayloadAction<string>) {
      state.customerEmail = action.payload
      state.transaction = emptyTransactionDraft
    },
    savePaymentDraft(state, action: PayloadAction<PaymentDraft>) {
      state.payment = action.payload
      state.transaction = emptyTransactionDraft
    },
    saveTransactionDraft(state, action: PayloadAction<TransactionDraft>) {
      state.transaction = action.payload
    },
    resetCheckout() {
      return initialCheckoutState
    },
  },
})

export const {
  moveToStep,
  resetCheckout,
  saveCustomerEmail,
  saveDeliveryDraft,
  savePaymentDraft,
  saveTransactionDraft,
  selectProduct,
} = checkoutSlice.actions

export default checkoutSlice.reducer
