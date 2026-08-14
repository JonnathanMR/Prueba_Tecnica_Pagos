import type { EntityId } from '../shared/entity-id';
import { DomainError } from '../shared/domain-error';
import { requireNonEmpty } from '../shared/validation';

export const deliveryStatuses = [
  'PENDING',
  'READY_FOR_SHIPMENT',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type DeliveryStatus = (typeof deliveryStatuses)[number];

export interface DeliveryProps {
  readonly id: EntityId;
  readonly transactionId: EntityId;
  readonly recipientName: string;
  readonly recipientPhone: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly department: string;
  readonly country: 'CO';
  readonly postalCode: string | null;
  readonly status: DeliveryStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const allowedTransitions: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
  PENDING: ['READY_FOR_SHIPMENT', 'CANCELLED'],
  READY_FOR_SHIPMENT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export class Delivery {
  readonly id!: EntityId;
  readonly transactionId!: EntityId;
  readonly recipientName!: string;
  readonly recipientPhone!: string;
  readonly addressLine1!: string;
  readonly addressLine2!: string | null;
  readonly city!: string;
  readonly department!: string;
  readonly country!: 'CO';
  readonly postalCode!: string | null;
  readonly status!: DeliveryStatus;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  constructor(props: DeliveryProps) {
    requireNonEmpty(props.recipientName, 'Recipient name');
    requireNonEmpty(props.recipientPhone, 'Recipient phone');
    requireNonEmpty(props.addressLine1, 'Delivery address');
    requireNonEmpty(props.city, 'Delivery city');
    requireNonEmpty(props.department, 'Delivery department');

    if (props.country !== 'CO') {
      throw new DomainError('Only deliveries in Colombia are supported.');
    }

    Object.assign(this, props);
  }

  transitionTo(status: DeliveryStatus, updatedAt = new Date()): Delivery {
    if (!allowedTransitions[this.status].includes(status)) {
      throw new DomainError(`Cannot transition delivery from ${this.status} to ${status}.`);
    }

    return new Delivery({ ...this, status, updatedAt });
  }
}
