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

export interface CheckoutState {
  currentStep: CheckoutStep
  selectedProductId: string | null
  delivery: DeliveryDraft
  payment: PaymentDraft
  transactionReference: string | null
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

export const initialCheckoutState: CheckoutState = {
  currentStep: 'product',
  selectedProductId: null,
  delivery: emptyDeliveryDraft,
  payment: emptyPaymentDraft,
  transactionReference: null,
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
      payment: {
        cardBrand: safeCardBrand(payment.cardBrand),
        cardLastFour: lastFour(payment.cardLastFour),
      },
      transactionReference:
        typeof draft.transactionReference === 'string' ? draft.transactionReference : null,
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
      payment: state.payment,
      transactionReference: state.transactionReference,
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
      state.selectedProductId = action.payload
    },
    saveDeliveryDraft(state, action: PayloadAction<DeliveryDraft>) {
      state.delivery = action.payload
    },
    savePaymentDraft(state, action: PayloadAction<PaymentDraft>) {
      state.payment = action.payload
    },
    setTransactionReference(state, action: PayloadAction<string | null>) {
      state.transactionReference = action.payload
    },
    resetCheckout() {
      return initialCheckoutState
    },
  },
})

export const {
  moveToStep,
  resetCheckout,
  saveDeliveryDraft,
  savePaymentDraft,
  selectProduct,
  setTransactionReference,
} = checkoutSlice.actions

export default checkoutSlice.reducer
