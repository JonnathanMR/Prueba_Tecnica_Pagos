import {
  type Result,
  failure,
  success,
} from '../shared/result';
import type { Stock } from '../../domain/stock/stock';
import type { StockRepositoryPort } from '../../domain/stock/stock-repository.port';
import { DomainError } from '../../domain/shared/domain-error';
import type { EntityId } from '../../domain/shared/entity-id';

export interface UpdateStockInput {
  readonly productId: EntityId;
  readonly quantity: number;
}

export type UpdateStockError =
  | 'STOCK_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'STOCK_VERSION_CONFLICT'
  | 'STOCK_UPDATE_FAILED';

export class UpdateStockUseCase {
  constructor(private readonly stockRepository: StockRepositoryPort) {}

  async execute(input: UpdateStockInput): Promise<Result<Stock, UpdateStockError>> {
    try {
      const stock = await this.stockRepository.findByProductId(input.productId);

      if (!stock) {
        return failure('STOCK_NOT_FOUND', 'Stock was not found for the selected product.');
      }

      const updatedStock = stock.decrease(input.quantity);
      const wasUpdated = await this.stockRepository.update(updatedStock, stock.version);

      if (!wasUpdated) {
        return failure('STOCK_VERSION_CONFLICT', 'Stock changed while the payment was processed.');
      }

      return success(updatedStock);
    } catch (error: unknown) {
      if (error instanceof DomainError && error.message === 'Insufficient stock.') {
        return failure('INSUFFICIENT_STOCK', error.message);
      }

      return failure('STOCK_UPDATE_FAILED', 'Unable to update the product stock.');
    }
  }
}
