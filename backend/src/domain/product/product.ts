import type { EntityId } from '../shared/entity-id';
import { DomainError } from '../shared/domain-error';
import { requireNonEmpty, requirePositiveInteger } from '../shared/validation';

export type ProductCurrency = 'COP';

export interface ProductProps {
  readonly id: EntityId;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly currency: ProductCurrency;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Product {
  readonly id!: EntityId;
  readonly sku!: string;
  readonly name!: string;
  readonly description!: string;
  readonly priceInCents!: number;
  readonly currency!: ProductCurrency;
  readonly isActive!: boolean;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  constructor(props: ProductProps) {
    requireNonEmpty(props.sku, 'Product SKU');
    requireNonEmpty(props.name, 'Product name');
    requireNonEmpty(props.description, 'Product description');
    requirePositiveInteger(props.priceInCents, 'Product price');

    if (props.currency !== 'COP') {
      throw new DomainError('Only COP is supported.');
    }

    Object.assign(this, props);
  }

  isPurchasable(): boolean {
    return this.isActive;
  }
}
