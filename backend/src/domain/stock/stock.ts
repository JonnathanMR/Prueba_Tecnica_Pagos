import type { EntityId } from '../shared/entity-id';
import { DomainError } from '../shared/domain-error';
import { requireNonNegativeInteger, requirePositiveInteger } from '../shared/validation';

export interface StockProps {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly availableQuantity: number;
  readonly version: number;
  readonly updatedAt: Date;
}

export class Stock {
  readonly id!: EntityId;
  readonly productId!: EntityId;
  readonly availableQuantity!: number;
  readonly version!: number;
  readonly updatedAt!: Date;

  constructor(props: StockProps) {
    requireNonNegativeInteger(props.availableQuantity, 'Available quantity');
    requireNonNegativeInteger(props.version, 'Stock version');
    Object.assign(this, props);
  }

  canFulfil(quantity: number): boolean {
    return Number.isSafeInteger(quantity) && quantity > 0 && this.availableQuantity >= quantity;
  }

  decrease(quantity: number, updatedAt = new Date()): Stock {
    requirePositiveInteger(quantity, 'Quantity');

    if (!this.canFulfil(quantity)) {
      throw new DomainError('Insufficient stock.');
    }

    return new Stock({
      ...this,
      availableQuantity: this.availableQuantity - quantity,
      version: this.version + 1,
      updatedAt,
    });
  }
}
