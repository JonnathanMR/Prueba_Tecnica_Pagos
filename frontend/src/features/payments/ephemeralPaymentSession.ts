import type { TokenizedCard } from '../checkout/checkoutApi'

/** El token es efímero: nunca se guarda en Redux, localStorage ni logs. */
let activePaymentSession: TokenizedCard | null = null

export function saveEphemeralPaymentSession(card: TokenizedCard): void {
  activePaymentSession = card
}

export function getEphemeralPaymentSession(): TokenizedCard | null {
  return activePaymentSession
}

export function clearEphemeralPaymentSession(): void {
  activePaymentSession = null
}
