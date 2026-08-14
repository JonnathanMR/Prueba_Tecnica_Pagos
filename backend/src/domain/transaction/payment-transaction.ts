import type { EntityId } from '../shared/entity-id';
import { DomainError } from '../shared/domain-error';
import { requireNonEmpty, requireNonNegativeInteger, requirePositiveInteger } from '../shared/validation';

export const paymentTransactionStatuses = [
  'PENDING',
  'APPROVED',
  'DECLINED',
  'ERROR',
  'VOIDED',
] as const;

export type PaymentTransactionStatus = (typeof paymentTransactionStatuses)[number];
export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN';

export interface PaymentMethodSnapshot {
  readonly type: 'CARD';
  readonly cardBrand: CardBrand;
  readonly cardLastFour: string;
}

export interface PaymentTransactionProps {
  readonly id: EntityId;
  readonly reference: string;
  readonly productId: EntityId;
  readonly customerId: EntityId;
  readonly status: PaymentTransactionStatus;
  readonly productAmountInCents: number;
  readonly baseFeeInCents: number;
  readonly shippingFeeInCents: number;
  readonly totalAmountInCents: number;
  readonly providerTransactionId: string | null;
  readonly paymentMethod: PaymentMethodSnapshot | null;
  readonly idempotencyKey: string;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly processedAt: Date | null;
}

const terminalStatuses: readonly PaymentTransactionStatus[] = [
  'APPROVED',
  'DECLINED',
  'ERROR',
  'VOIDED',
];

export class PaymentTransaction {
  readonly id!: EntityId;
  readonly reference!: string;
  readonly productId!: EntityId;
  readonly customerId!: EntityId;
  readonly status!: PaymentTransactionStatus;
  readonly productAmountInCents!: number;
  readonly baseFeeInCents!: number;
  readonly shippingFeeInCents!: number;
  readonly totalAmountInCents!: number;
  readonly providerTransactionId!: string | null;
  readonly paymentMethod!: PaymentMethodSnapshot | null;
  readonly idempotencyKey!: string;
  readonly failureCode!: string | null;
  readonly failureMessage!: string | null;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;
  readonly processedAt!: Date | null;

  constructor(props: PaymentTransactionProps) {
    requireNonEmpty(props.reference, 'Transaction reference');
    requireNonEmpty(props.idempotencyKey, 'Idempotency key');
    requirePositiveInteger(props.productAmountInCents, 'Product amount');
    requireNonNegativeInteger(props.baseFeeInCents, 'Base fee');
    requireNonNegativeInteger(props.shippingFeeInCents, 'Shipping fee');
    requirePositiveInteger(props.totalAmountInCents, 'Total amount');

    if (
      props.totalAmountInCents !==
      props.productAmountInCents + props.baseFeeInCents + props.shippingFeeInCents
    ) {
      throw new DomainError('Transaction total does not match its components.');
    }

    if (props.paymentMethod && !/^\d{4}$/.test(props.paymentMethod.cardLastFour)) {
      throw new DomainError('Card last four must contain exactly four digits.');
    }

    Object.assign(this, props);
  }

  approve(
    providerTransactionId: string,
    paymentMethod: PaymentMethodSnapshot,
    processedAt = new Date(),
  ): PaymentTransaction {
    this.ensurePending();
    requireNonEmpty(providerTransactionId, 'Provider transaction ID');

    return new PaymentTransaction({
      ...this,
      status: 'APPROVED',
      providerTransactionId,
      paymentMethod,
      failureCode: null,
      failureMessage: null,
      processedAt,
      updatedAt: processedAt,
    });
  }

  registerProviderReference(
    providerTransactionId: string,
    updatedAt = new Date(),
  ): PaymentTransaction {
    this.ensurePending();
    requireNonEmpty(providerTransactionId, 'Provider transaction ID');

    return new PaymentTransaction({
      ...this,
      providerTransactionId,
      updatedAt,
    });
  }

  reject(
    status: 'DECLINED' | 'ERROR' | 'VOIDED',
    failureCode: string | null,
    failureMessage: string | null,
    processedAt = new Date(),
  ): PaymentTransaction {
    this.ensurePending();

    return new PaymentTransaction({
      ...this,
      status,
      failureCode,
      failureMessage,
      processedAt,
      updatedAt: processedAt,
    });
  }

  isTerminal(): boolean {
    return terminalStatuses.includes(this.status);
  }

  private ensurePending(): void {
    if (this.status !== 'PENDING') {
      throw new DomainError(`Transaction ${this.reference} has already been processed.`);
    }
  }
}
