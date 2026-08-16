import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ListProductsUseCase } from '../catalog/list-products.use-case';
import { SandboxPaymentGatewayAdapter } from '../../infrastructure/payments/sandbox-payment-gateway.adapter';
import {
  CUSTOMER_REPOSITORY,
  DELIVERY_REPOSITORY,
  PRODUCT_REPOSITORY,
  STOCK_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../infrastructure/persistence/persistence.tokens';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { GetTransactionUseCase } from './get-transaction.use-case';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import { ProcessPaymentUseCase } from './process-payment.use-case';
import { RefreshPaymentStatusUseCase } from './refresh-payment-status.use-case';
import { UpdateStockUseCase } from './update-stock.use-case';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

@Module({
  imports: [PersistenceModule],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: () =>
        new SandboxPaymentGatewayAdapter({
          baseUrl: process.env.PAYMENT_GATEWAY_BASE_URL ?? '',
          publicKey: process.env.PAYMENT_GATEWAY_PUBLIC_KEY ?? '',
          privateKey: process.env.PAYMENT_GATEWAY_PRIVATE_KEY ?? '',
          integritySecret: process.env.PAYMENT_GATEWAY_INTEGRITY_SECRET ?? '',
        }),
    },
    {
      provide: ListProductsUseCase,
      useFactory: (productRepository, stockRepository) =>
        new ListProductsUseCase(productRepository, stockRepository),
      inject: [PRODUCT_REPOSITORY, STOCK_REPOSITORY],
    },
    {
      provide: UpdateStockUseCase,
      useFactory: (stockRepository) => new UpdateStockUseCase(stockRepository),
      inject: [STOCK_REPOSITORY],
    },
    {
      provide: CreateTransactionUseCase,
      useFactory: (
        productRepository,
        stockRepository,
        customerRepository,
        deliveryRepository,
        transactionRepository,
      ) =>
        new CreateTransactionUseCase({
          productRepository,
          stockRepository,
          customerRepository,
          deliveryRepository,
          transactionRepository,
          generateId: randomUUID,
          generateReference: () => `pay-${Date.now()}-${randomUUID().slice(0, 8)}`,
          now: () => new Date(),
        }),
      inject: [
        PRODUCT_REPOSITORY,
        STOCK_REPOSITORY,
        CUSTOMER_REPOSITORY,
        DELIVERY_REPOSITORY,
        TRANSACTION_REPOSITORY,
      ],
    },
    {
      provide: GetTransactionUseCase,
      useFactory: (transactionRepository, deliveryRepository) =>
        new GetTransactionUseCase(transactionRepository, deliveryRepository),
      inject: [TRANSACTION_REPOSITORY, DELIVERY_REPOSITORY],
    },
    {
      provide: ProcessPaymentUseCase,
      useFactory: (
        transactionRepository,
        customerRepository,
        deliveryRepository,
        paymentGateway,
        updateStock,
      ) =>
        new ProcessPaymentUseCase({
          transactionRepository,
          customerRepository,
          deliveryRepository,
          paymentGateway,
          updateStock,
          now: () => new Date(),
        }),
      inject: [
        TRANSACTION_REPOSITORY,
        CUSTOMER_REPOSITORY,
        DELIVERY_REPOSITORY,
        PAYMENT_GATEWAY,
        UpdateStockUseCase,
      ],
    },
    {
      provide: RefreshPaymentStatusUseCase,
      useFactory: (transactionRepository, deliveryRepository, paymentGateway, updateStock) =>
        new RefreshPaymentStatusUseCase({
          transactionRepository,
          deliveryRepository,
          paymentGateway,
          updateStock,
          now: () => new Date(),
        }),
      inject: [
        TRANSACTION_REPOSITORY,
        DELIVERY_REPOSITORY,
        PAYMENT_GATEWAY,
        UpdateStockUseCase,
      ],
    },
  ],
  exports: [
    PAYMENT_GATEWAY,
    ListProductsUseCase,
    CreateTransactionUseCase,
    GetTransactionUseCase,
    ProcessPaymentUseCase,
    RefreshPaymentStatusUseCase,
  ],
})
export class CheckoutModule {}
