import type { EntityId } from '../shared/entity-id';
import type { Customer } from './customer';

export interface CustomerRepositoryPort {
  findById(id: EntityId): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
