import type { SafeCardBrand } from './checkoutSlice'
import { apiUrl } from '../../config/api-url'

export interface AcceptanceData {
  readonly acceptanceToken: string
  readonly acceptancePermalink: string
  readonly personalDataAuthToken: string
  readonly personalDataAuthPermalink: string
}

export interface TokenizedCard {
  readonly token: string
  readonly brand: SafeCardBrand
  readonly lastFour: string
}

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED'

export interface TransactionResponse {
  readonly id: string
  readonly reference: string
  readonly status: TransactionStatus
  readonly amounts: {
    readonly productInCents: number
    readonly baseFeeInCents: number
    readonly shippingFeeInCents: number
    readonly totalInCents: number
  }
  readonly paymentMethod: {
    readonly type: 'CARD'
    readonly cardBrand: SafeCardBrand | 'UNKNOWN'
    readonly cardLastFour: string
  } | null
  readonly failure: {
    readonly code: string | null
    readonly message: string | null
  }
  readonly delivery: {
    readonly status: string
    readonly city: string
    readonly department: string
  }
}

interface ApiEnvelope<T> {
  readonly data: T
}

export interface CreateTransactionInput {
  readonly productId: string
  readonly idempotencyKey: string
  readonly baseFeeInCents: number
  readonly shippingFeeInCents: number
  readonly customer: {
    readonly fullName: string
    readonly email: string
    readonly phone: string
  }
  readonly delivery: {
    readonly recipientName: string
    readonly recipientPhone: string
    readonly addressLine1: string
    readonly city: string
    readonly department: string
    readonly country: 'CO'
  }
}

export interface ProcessPaymentInput {
  readonly transactionId: string
  readonly cardToken: string
  readonly cardBrand: SafeCardBrand
  readonly cardLastFour: string
  readonly acceptanceToken: string
  readonly acceptPersonalAuth: string
}

export async function getAcceptanceData(signal?: AbortSignal): Promise<AcceptanceData> {
  return request<AcceptanceData>('/api/checkout/acceptance-data', { signal })
}

export async function tokenizeCard(input: {
  readonly number: string
  readonly cvc: string
  readonly expMonth: string
  readonly expYear: string
  readonly cardHolder: string
}): Promise<TokenizedCard> {
  const response = await request<{ token: string; brand: string; lastFour: string }>('/api/checkout/cards/tokenize', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  if ((response.brand !== 'VISA' && response.brand !== 'MASTERCARD') || !/^\d{4}$/.test(response.lastFour)) {
    throw new Error('La pasarela no pudo validar la franquicia de la tarjeta.')
  }

  return {
    token: response.token,
    brand: response.brand,
    lastFour: response.lastFour,
  }
}

export async function createTransaction(input: CreateTransactionInput): Promise<TransactionResponse> {
  return request<TransactionResponse>('/api/checkout/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function processPayment(input: ProcessPaymentInput): Promise<TransactionResponse> {
  const { transactionId, ...body } = input
  return request<TransactionResponse>(`/api/checkout/transactions/${encodeURIComponent(transactionId)}/payments`, {
    method: 'POST',
    body: JSON.stringify({ ...body, installments: 1 }),
  })
}

export async function getTransaction(transactionId: string, signal?: AbortSignal): Promise<TransactionResponse> {
  return request<TransactionResponse>(`/api/checkout/transactions/${encodeURIComponent(transactionId)}`, {
    cache: 'no-store',
    signal,
  })
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) throw new Error(errorMessage(payload))
  if (!isApiEnvelope<T>(payload)) throw new Error('La respuesta del servidor no tiene el formato esperado.')

  return payload.data
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === 'object' && value !== null && 'data' in value
}

function errorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as { error?: unknown }).error
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message
    }
  }
  return 'No pudimos procesar la solicitud. Inténtalo de nuevo.'
}
