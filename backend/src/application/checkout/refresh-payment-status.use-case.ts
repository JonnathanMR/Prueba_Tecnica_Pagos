import {
  type Result,
  failure,
  success,
} from '../shared/result';
import type { DeliveryRepositoryPort } from '../../domain/delivery/delivery-repository.port';
import type { EntityId } from '../../domain/shared/entity-id';
import type { PaymentGatewayPort } from '../../domain/transaction/payment-gateway.port';
import type { PaymentTransaction } from '../../domain/transaction/payment-transaction';
import type { PaymentTransactionRepositoryPort } from '../../domain/transaction/payment-transaction-repository.port';
import {
  type UpdateStockError,
  UpdateStockUseCase,
} from './update-stock.use-case';

export interface RefreshPaymentStatusOutput {
  readonly transaction: PaymentTransaction;
  readonly stockUpdated: boolean;
}

export type RefreshPaymentStatusError =
  | 'TRANSACTION_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'PAYMENT_METHOD_MISSING'
  | 'PAYMENT_STATUS_REFRESH_FAILED'
  | 'DELIVERY_UPDATE_FAILED'
  | UpdateStockError;

export interface RefreshPaymentStatusDependencies {
  readonly transactionRepository: PaymentTransactionRepositoryPort;
  readonly deliveryRepository: DeliveryRepositoryPort;
  readonly paymentGateway: PaymentGatewayPort;
  readonly updateStock: UpdateStockUseCase;
  readonly now: () => Date;
}

/** Sincroniza una transacción pendiente con el estado reportado por la pasarela. */
export class RefreshPaymentStatusUseCase {
  constructor(private readonly dependencies: RefreshPaymentStatusDependencies) {}

  async execute(
    transactionId: EntityId,
  ): Promise<Result<RefreshPaymentStatusOutput, RefreshPaymentStatusError>> {
    try {
      const transaction = await this.dependencies.transactionRepository.findById(transactionId);
      if (!transaction) return failure('TRANSACTION_NOT_FOUND', 'The payment transaction does not exist.');

      if (transaction.isTerminal() || !transaction.providerTransactionId) {
        return success({ transaction, stockUpdated: false });
      }

      const delivery = await this.dependencies.deliveryRepository.findByTransactionId(transaction.id);
      if (!delivery) return failure('DELIVERY_NOT_FOUND', 'The transaction delivery was not found.');

      const gatewayResult = await this.dependencies.paymentGateway.findPayment(
        transaction.providerTransactionId,
      );
      const now = this.dependencies.now();

      if (gatewayResult.status === 'PENDING') {
        return success({ transaction, stockUpdated: false });
      }

      if (gatewayResult.status === 'APPROVED') {
        if (!transaction.paymentMethod) {
          return failure('PAYMENT_METHOD_MISSING', 'The pending transaction has no payment method.');
        }

        const approvedTransaction = transaction.approve(
          gatewayResult.providerTransactionId,
          transaction.paymentMethod,
          now,
        );
        await this.dependencies.transactionRepository.save(approvedTransaction);

        const stockResult = await this.dependencies.updateStock.execute({
          productId: approvedTransaction.productId,
          quantity: 1,
        });
        if (!stockResult.ok) return stockResult;

        const readyDelivery = delivery.transitionTo('READY_FOR_SHIPMENT', now);
        await this.dependencies.deliveryRepository.save(readyDelivery);
        return success({ transaction: approvedTransaction, stockUpdated: true });
      }

      const rejectedTransaction = transaction.reject(
        gatewayResult.status,
        gatewayResult.failureCode,
        gatewayResult.failureMessage,
        now,
      );
      await this.dependencies.transactionRepository.save(rejectedTransaction);
      return success({ transaction: rejectedTransaction, stockUpdated: false });
    } catch {
      return failure('PAYMENT_STATUS_REFRESH_FAILED', 'Unable to refresh the payment transaction status.');
    }
  }
}
