import { Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { appDataSource } from './typeorm/data-source';
import {
  TypeOrmCustomerRepository,
  TypeOrmDeliveryRepository,
  TypeOrmPaymentTransactionRepository,
  TypeOrmProductRepository,
  TypeOrmStockRepository,
} from './typeorm/typeorm-repositories';
import {
  CUSTOMER_REPOSITORY,
  DELIVERY_REPOSITORY,
  PRODUCT_REPOSITORY,
  STOCK_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from './persistence.tokens';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}

/**
 * Adaptadores PostgreSQL que implementan los puertos del dominio.
 */
@Module({
  providers: [
    {
      provide: DataSource,
      useFactory: async (): Promise<DataSource> => {
        if (!appDataSource.isInitialized) await appDataSource.initialize();
        return appDataSource;
      },
    },
    DatabaseLifecycle,
    {
      provide: PRODUCT_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeOrmProductRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: STOCK_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeOrmStockRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: CUSTOMER_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeOrmCustomerRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: DELIVERY_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeOrmDeliveryRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeOrmPaymentTransactionRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [
    PRODUCT_REPOSITORY,
    STOCK_REPOSITORY,
    CUSTOMER_REPOSITORY,
    DELIVERY_REPOSITORY,
    TRANSACTION_REPOSITORY,
  ],
})
export class PersistenceModule {}
