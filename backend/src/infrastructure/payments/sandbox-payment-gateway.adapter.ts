import { createHash } from 'node:crypto';

import type {
  AcceptanceData,
  CardTokenizationInput,
  CreateCardPaymentInput,
  GatewayPaymentResult,
  PaymentGatewayPort,
  TokenizedCard,
} from '../../domain/transaction/payment-gateway.port';
import type { CardBrand, PaymentTransactionStatus } from '../../domain/transaction/payment-transaction';
import { encryptCardAsJwe } from './card-jwe-encryptor';

export interface SandboxPaymentGatewayConfig {
  readonly baseUrl: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly integritySecret: string;
}

type FetchFunction = typeof fetch;

export class SandboxPaymentGatewayAdapter implements PaymentGatewayPort {
  private tokenizationPublicKey: string | null = null;

  constructor(
    private readonly config: SandboxPaymentGatewayConfig,
    private readonly request: FetchFunction = fetch,
  ) {
    this.assertConfiguration();
  }

  async getAcceptanceData(): Promise<AcceptanceData> {
    const response = await this.fetchJson(`/merchants/${this.config.publicKey}`, {
      method: 'GET',
    });
    const data = responseData(response);
    const acceptance = objectValue(data.presigned_acceptance);
    const personalDataAuthorization = objectValue(data.presigned_personal_data_auth);

    return {
      acceptanceToken: stringValue(acceptance.acceptance_token, 'acceptance token'),
      acceptancePermalink: stringValue(acceptance.permalink, 'acceptance permalink'),
      personalDataAuthToken: stringValue(
        personalDataAuthorization.acceptance_token,
        'personal data authorization token',
      ),
      personalDataAuthPermalink: stringValue(
        personalDataAuthorization.permalink,
        'personal data authorization permalink',
      ),
    };
  }

  async tokenizeCard(input: CardTokenizationInput): Promise<TokenizedCard> {
    const publicKey = await this.getTokenizationPublicKey();
    const payload = encryptCardAsJwe(input, publicKey);
    const response = await this.fetchJson('/tokens/cards', {
      method: 'POST',
      headers: this.bearerHeaders(this.config.publicKey),
      body: JSON.stringify({ payload }),
    });
    const data = responseData(response);

    return {
      token: stringValue(data.id, 'card token'),
      brand: toCardBrand(data.brand),
      lastFour: stringValue(data.last_four, 'card last four'),
    };
  }

  async createCardPayment(input: CreateCardPaymentInput): Promise<GatewayPaymentResult> {
    const signature = this.createIntegritySignature(input);
    const response = await this.fetchJson('/transactions', {
      method: 'POST',
      headers: this.bearerHeaders(this.config.privateKey),
      body: JSON.stringify({
        acceptance_token: input.acceptanceToken,
        accept_personal_auth: input.acceptPersonalAuth,
        amount_in_cents: input.amountInCents,
        currency: input.currency,
        customer_email: input.customerEmail,
        reference: input.reference,
        signature,
        ip: input.customerIp,
        payment_method: {
          type: 'CARD',
          token: input.cardToken,
          installments: input.installments,
        },
      }),
    });

    return toGatewayPaymentResult(responseData(response));
  }

  async findPayment(providerTransactionId: string): Promise<GatewayPaymentResult> {
    const response = await this.fetchJson(`/transactions/${encodeURIComponent(providerTransactionId)}`, {
      method: 'GET',
      headers: this.bearerHeaders(this.config.publicKey),
    });

    return toGatewayPaymentResult(responseData(response));
  }

  private async getTokenizationPublicKey(): Promise<string> {
    if (this.tokenizationPublicKey) return this.tokenizationPublicKey;

    const response = await this.fetchJson('/tokens/keys/tokenization', {
      method: 'GET',
      headers: this.bearerHeaders(this.config.publicKey),
    });
    this.tokenizationPublicKey = stringValue(responseData(response).publicKey, 'tokenization key');
    return this.tokenizationPublicKey;
  }

  private createIntegritySignature(input: CreateCardPaymentInput): string {
    return createHash('sha256')
      .update(
        `${input.reference}${input.amountInCents}${input.currency}${this.config.integritySecret}`,
        'utf8',
      )
      .digest('hex');
  }

  private bearerHeaders(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchJson(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;

    try {
      response = await this.request(`${this.config.baseUrl}${path}`, init);
    } catch {
      throw new PaymentGatewayError('The payment gateway is unavailable.');
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // The provider must respond with JSON. Do not expose its raw body in errors.
    }

    if (!response.ok) {
      throw new PaymentGatewayError(`The payment gateway rejected the request (${response.status}).`);
    }

    return payload;
  }

  private assertConfiguration(): void {
    for (const [key, value] of Object.entries(this.config)) {
      if (value.trim().length === 0) {
        throw new PaymentGatewayError(`${key} must be configured.`);
      }
    }
  }
}

export class PaymentGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

function responseData(response: unknown): Record<string, unknown> {
  const envelope = objectValue(response);
  return objectValue(envelope.data);
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PaymentGatewayError('The payment gateway returned an invalid response.');
  }

  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PaymentGatewayError(`The payment gateway response is missing ${field}.`);
  }

  return value;
}

function toCardBrand(value: unknown): CardBrand {
  if (value === 'VISA') return 'VISA';
  if (value === 'MASTERCARD') return 'MASTERCARD';
  return 'UNKNOWN';
}

function toGatewayPaymentResult(data: Record<string, unknown>): GatewayPaymentResult {
  const status = toPaymentStatus(data.status);

  return {
    providerTransactionId: stringValue(data.id, 'transaction ID'),
    status,
    failureCode: status === 'APPROVED' || status === 'PENDING' ? null : stringOrNull(data.error_code),
    failureMessage:
      status === 'APPROVED' || status === 'PENDING' ? null : stringOrNull(data.status_message),
  };
}

function toPaymentStatus(value: unknown): PaymentTransactionStatus {
  if (
    value === 'PENDING' ||
    value === 'APPROVED' ||
    value === 'DECLINED' ||
    value === 'ERROR' ||
    value === 'VOIDED'
  ) {
    return value;
  }

  return 'ERROR';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
