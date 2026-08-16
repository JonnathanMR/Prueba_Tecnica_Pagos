import type { ProductCurrency } from '../product/product';
import type { CardBrand, PaymentTransactionStatus } from './payment-transaction';

/** Datos efímeros: nunca deben persistirse ni incluirse en logs. */
export interface CardTokenizationInput {
  readonly number: string;
  readonly cvc: string;
  readonly expMonth: string;
  readonly expYear: string;
  readonly cardHolder: string;
}

export interface TokenizedCard {
  readonly token: string;
  readonly brand: CardBrand;
  readonly lastFour: string;
}

export interface CreateCardPaymentInput {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: ProductCurrency;
  readonly customerEmail: string;
  readonly cardToken: string;
  readonly idempotencyKey: string;
  readonly installments: number;
  readonly acceptanceToken: string;
  readonly acceptPersonalAuth: string;
  readonly customerIp: string;
}

export interface GatewayPaymentResult {
  readonly providerTransactionId: string;
  readonly status: PaymentTransactionStatus;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
}

export interface AcceptanceData {
  readonly acceptanceToken: string;
  readonly acceptancePermalink: string;
  readonly personalDataAuthToken: string;
  readonly personalDataAuthPermalink: string;
}

export interface PaymentGatewayPort {
  getAcceptanceData(): Promise<AcceptanceData>;
  tokenizeCard(input: CardTokenizationInput): Promise<TokenizedCard>;
  createCardPayment(input: CreateCardPaymentInput): Promise<GatewayPaymentResult>;
  findPayment(providerTransactionId: string): Promise<GatewayPaymentResult>;
}
