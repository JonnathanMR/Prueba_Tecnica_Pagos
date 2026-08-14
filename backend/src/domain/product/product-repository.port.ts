import type { EntityId } from '../shared/entity-id';
import type { Product } from './product';

export interface ProductRepositoryPort {
  findById(id: EntityId): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findActive(): Promise<readonly Product[]>;
}
