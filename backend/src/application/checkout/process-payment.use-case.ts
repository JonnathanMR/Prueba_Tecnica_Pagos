import {
  type Result,
  failure,
  success,
} from '../shared/result';
import type { CustomerRepositoryPort } from '../../domain/customer/customer-repository.port';
import type { DeliveryRepositoryPort } from '../../domain/delivery/delivery-repository.port';
import type { EntityId } from '../../domain/shared/entity-id';
import type {
  PaymentGatewayPort,
} from '../../domain/transaction/payment-gateway.port';
import type {
  PaymentMethodSnapshot,
  PaymentTransaction,
} from '../../domain/transaction/payment-transaction';
import type { PaymentTransactionRepositoryPort } from '../../domain/transaction/payment-transaction-repository.port';
import {
  type UpdateStockError,
  UpdateStockUseCase,
} from './update-stock.use-case';

export interface ProcessPaymentInput {
  readonly transactionId: EntityId;
  readonly cardToken: string;
  readonly paymentMethod: PaymentMethodSnapshot;
}

export interface ProcessPaymentOutput {
  readonly transaction: PaymentTransaction;
  readonly stockUpdated: boolean;
  readonly reused: boolean;
}

export type ProcessPaymentError =
  | 'TRANSACTION_NOT_FOUND'
  | 'CUSTOMER_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'PAYMENT_PROCESSING_FAILED'
  | 'DELIVERY_UPDATE_FAILED'
  | UpdateStockError;

export interface ProcessPaymentDependencies {
  readonly transactionRepository: PaymentTransactionRepositoryPort;
  readonly customerRepository: CustomerRepositoryPort;
  readonly deliveryRepository: DeliveryRepositoryPort;
  readonly paymentGateway: PaymentGatewayPort;
  readonly updateStock: UpdateStockUseCase;
  readonly now: () => Date;
}

export class ProcessPaymentUseCase {
  constructor(private readonly dependencies: ProcessPaymentDependencies) {}

  async execute(
    input: ProcessPaymentInput,
  ): Promise<Result<ProcessPaymentOutput, ProcessPaymentError>> {
    try {
      const transaction = await this.dependencies.transactionRepository.findById(input.transactionId);
      if (!transaction) {
        return failure('TRANSACTION_NOT_FOUND', 'The payment transaction does not exist.');
      }

      if (transaction.isTerminal()) {
        return success({ transaction, stockUpdated: false, reused: true });
      }

      const customer = await this.dependencies.customerRepository.findById(transaction.customerId);
      if (!customer) return failure('CUSTOMER_NOT_FOUND', 'The transaction customer was not found.');

      const delivery = await this.dependencies.deliveryRepository.findByTransactionId(transaction.id);
      if (!delivery) return failure('DELIVERY_NOT_FOUND', 'The transaction delivery was not found.');

      const gatewayResult = await this.dependencies.paymentGateway.createCardPayment({
        reference: transaction.reference,
        amountInCents: transaction.totalAmountInCents,
        currency: 'COP',
        customerEmail: customer.email,
        cardToken: input.cardToken,
        idempotencyKey: transaction.idempotencyKey,
      });
      const now = this.dependencies.now();

      if (gatewayResult.status === 'PENDING') {
        const pendingTransaction = transaction.registerProviderReference(
          gatewayResult.providerTransactionId,
          now,
        );
        await this.dependencies.transactionRepository.save(pendingTransaction);
        return success({ transaction: pendingTransaction, stockUpdated: false, reused: false });
      }

      if (gatewayResult.status === 'APPROVED') {
        const approvedTransaction = transaction.approve(
          gatewayResult.providerTransactionId,
          input.paymentMethod,
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

        return success({ transaction: approvedTransaction, stockUpdated: true, reused: false });
      }

      const rejectedTransaction = transaction.reject(
        gatewayResult.status,
        gatewayResult.failureCode,
        gatewayResult.failureMessage,
        now,
      );
      await this.dependencies.transactionRepository.save(rejectedTransaction);
      return success({ transaction: rejectedTransaction, stockUpdated: false, reused: false });
    } catch {
      return failure('PAYMENT_PROCESSING_FAILED', 'Unable to process the payment transaction.');
    }
  }
}
