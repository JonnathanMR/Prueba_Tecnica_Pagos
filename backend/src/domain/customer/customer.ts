import type { EntityId } from '../shared/entity-id';
import { DomainError } from '../shared/domain-error';
import { requireNonEmpty } from '../shared/validation';

export interface CustomerProps {
  readonly id: EntityId;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly documentType: string | null;
  readonly documentNumber: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Customer {
  readonly id!: EntityId;
  readonly fullName!: string;
  readonly email!: string;
  readonly phone!: string;
  readonly documentType!: string | null;
  readonly documentNumber!: string | null;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  constructor(props: CustomerProps) {
    requireNonEmpty(props.fullName, 'Customer name');
    requireNonEmpty(props.phone, 'Customer phone');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new DomainError('Customer email is invalid.');
    }

    Object.assign(this, { ...props, email: props.email.trim().toLowerCase() });
  }
}
