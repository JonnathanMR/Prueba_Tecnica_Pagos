import { DomainError } from './domain-error';

export function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new DomainError(`${field} is required.`);
  }
}

export function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(`${field} must be a positive integer.`);
  }
}

export function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(`${field} must be a non-negative integer.`);
  }
}
