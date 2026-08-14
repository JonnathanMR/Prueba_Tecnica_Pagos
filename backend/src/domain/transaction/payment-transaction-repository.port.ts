import type { EntityId } from '../shared/entity-id';
import type { PaymentTransaction } from './payment-transaction';

export interface PaymentTransactionRepositoryPort {
  findById(id: EntityId): Promise<PaymentTransaction | null>;
  findByReference(reference: string): Promise<PaymentTransaction | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PaymentTransaction | null>;
  save(transaction: PaymentTransaction): Promise<void>;
}
