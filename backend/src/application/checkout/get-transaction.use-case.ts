import {
  type Result,
  failure,
  success,
} from '../shared/result';
import type { Delivery } from '../../domain/delivery/delivery';
import type { DeliveryRepositoryPort } from '../../domain/delivery/delivery-repository.port';
import type { EntityId } from '../../domain/shared/entity-id';
import type { PaymentTransaction } from '../../domain/transaction/payment-transaction';
import type { PaymentTransactionRepositoryPort } from '../../domain/transaction/payment-transaction-repository.port';

export interface GetTransactionOutput {
  readonly transaction: PaymentTransaction;
  readonly delivery: Delivery;
}

export type GetTransactionError = 'TRANSACTION_NOT_FOUND' | 'DELIVERY_NOT_FOUND';

export class GetTransactionUseCase {
  constructor(
    private readonly transactionRepository: PaymentTransactionRepositoryPort,
    private readonly deliveryRepository: DeliveryRepositoryPort,
  ) {}

  async execute(id: EntityId): Promise<Result<GetTransactionOutput, GetTransactionError>> {
    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      return failure('TRANSACTION_NOT_FOUND', 'The payment transaction does not exist.');
    }

    const delivery = await this.deliveryRepository.findByTransactionId(transaction.id);
    if (!delivery) {
      return failure('DELIVERY_NOT_FOUND', 'The transaction delivery was not found.');
    }

    return success({ transaction, delivery });
  }
}
