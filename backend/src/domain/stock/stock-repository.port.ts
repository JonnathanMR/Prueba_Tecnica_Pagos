import type { EntityId } from '../shared/entity-id';
import type { Stock } from './stock';

export interface StockRepositoryPort {
  findByProductId(productId: EntityId): Promise<Stock | null>;
  update(stock: Stock, expectedVersion: number): Promise<boolean>;
}
