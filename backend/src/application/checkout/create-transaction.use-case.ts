import {
  type Result,
  failure,
  success,
} from '../shared/result';
import { Customer, type CustomerProps } from '../../domain/customer/customer';
import type { CustomerRepositoryPort } from '../../domain/customer/customer-repository.port';
import { Delivery, type DeliveryProps } from '../../domain/delivery/delivery';
import type { DeliveryRepositoryPort } from '../../domain/delivery/delivery-repository.port';
import type { ProductRepositoryPort } from '../../domain/product/product-repository.port';
import { DomainError } from '../../domain/shared/domain-error';
import type { EntityId } from '../../domain/shared/entity-id';
import type { StockRepositoryPort } from '../../domain/stock/stock-repository.port';
import {
  PaymentTransaction,
  type PaymentTransactionProps,
} from '../../domain/transaction/payment-transaction';
import type { PaymentTransactionRepositoryPort } from '../../domain/transaction/payment-transaction-repository.port';

export interface CreateTransactionInput {
  readonly productId: EntityId;
  readonly idempotencyKey: string;
  readonly baseFeeInCents: number;
  readonly shippingFeeInCents: number;
  readonly customer: Omit<CustomerProps, 'id' | 'createdAt' | 'updatedAt'>;
  readonly delivery: Omit<
    DeliveryProps,
    'id' | 'transactionId' | 'status' | 'createdAt' | 'updatedAt'
  >;
}

export interface CreateTransactionOutput {
  readonly transaction: PaymentTransaction;
  readonly delivery: Delivery;
  readonly reused: boolean;
}

export type CreateTransactionError =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'INVALID_TRANSACTION_INPUT'
  | 'TRANSACTION_INCOMPLETE'
  | 'TRANSACTION_CREATION_FAILED';

export interface CreateTransactionDependencies {
  readonly productRepository: ProductRepositoryPort;
  readonly stockRepository: StockRepositoryPort;
  readonly customerRepository: CustomerRepositoryPort;
  readonly deliveryRepository: DeliveryRepositoryPort;
  readonly transactionRepository: PaymentTransactionRepositoryPort;
  readonly generateId: () => EntityId;
  readonly generateReference: () => string;
  readonly now: () => Date;
}

export class CreateTransactionUseCase {
  constructor(private readonly dependencies: CreateTransactionDependencies) {}

  async execute(
    input: CreateTransactionInput,
  ): Promise<Result<CreateTransactionOutput, CreateTransactionError>> {
    try {
      const existingTransaction = await this.dependencies.transactionRepository.findByIdempotencyKey(
        input.idempotencyKey,
      );

      if (existingTransaction) {
        const existingDelivery = await this.dependencies.deliveryRepository.findByTransactionId(
          existingTransaction.id,
        );

        if (!existingDelivery) {
          return failure(
            'TRANSACTION_INCOMPLETE',
            'The existing transaction does not have a delivery record.',
          );
        }

        return success({
          transaction: existingTransaction,
          delivery: existingDelivery,
          reused: true,
        });
      }

      const product = await this.dependencies.productRepository.findById(input.productId);
      if (!product) return failure('PRODUCT_NOT_FOUND', 'The selected product does not exist.');
      if (!product.isPurchasable()) {
        return failure('PRODUCT_INACTIVE', 'The selected product is not available for purchase.');
      }

      const stock = await this.dependencies.stockRepository.findByProductId(product.id);
      if (!stock || !stock.canFulfil(1)) {
        return failure('OUT_OF_STOCK', 'The selected product is out of stock.');
      }

      const now = this.dependencies.now();
      const customer = await this.findOrCreateCustomer(input.customer, now);
      const transaction = new PaymentTransaction({
        id: this.dependencies.generateId(),
        reference: this.dependencies.generateReference(),
        productId: product.id,
        customerId: customer.id,
        status: 'PENDING',
        productAmountInCents: product.priceInCents,
        baseFeeInCents: input.baseFeeInCents,
        shippingFeeInCents: input.shippingFeeInCents,
        totalAmountInCents:
          product.priceInCents + input.baseFeeInCents + input.shippingFeeInCents,
        providerTransactionId: null,
        paymentMethod: null,
        idempotencyKey: input.idempotencyKey,
        failureCode: null,
        failureMessage: null,
        createdAt: now,
        updatedAt: now,
        processedAt: null,
      } satisfies PaymentTransactionProps);
      const delivery = new Delivery({
        id: this.dependencies.generateId(),
        transactionId: transaction.id,
        ...input.delivery,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });

      await this.dependencies.transactionRepository.save(transaction);
      await this.dependencies.deliveryRepository.save(delivery);

      return success({ transaction, delivery, reused: false });
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        return failure('INVALID_TRANSACTION_INPUT', error.message);
      }

      return failure('TRANSACTION_CREATION_FAILED', 'Unable to create the payment transaction.');
    }
  }

  private async findOrCreateCustomer(
    input: CreateTransactionInput['customer'],
    now: Date,
  ): Promise<Customer> {
    const email = input.email.trim().toLowerCase();
    const existingCustomer = await this.dependencies.customerRepository.findByEmail(email);
    if (existingCustomer) return existingCustomer;

    const customer = new Customer({
      id: this.dependencies.generateId(),
      ...input,
      email,
      createdAt: now,
      updatedAt: now,
    });
    await this.dependencies.customerRepository.save(customer);
    return customer;
  }
}
