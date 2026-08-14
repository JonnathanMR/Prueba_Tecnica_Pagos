import type { EntityId } from '../shared/entity-id';
import type { Delivery } from './delivery';

export interface DeliveryRepositoryPort {
  findByTransactionId(transactionId: EntityId): Promise<Delivery | null>;
  save(delivery: Delivery): Promise<void>;
}
