import { Stock } from '../../domain/stock/stock';
import { UpdateStockUseCase } from './update-stock.use-case';

const now = new Date('2026-08-16T12:00:00.000Z');

describe('UpdateStockUseCase', () => {
  it('decreases stock using optimistic concurrency', async () => {
    const repository = {
      findByProductId: jest.fn().mockResolvedValue(stock(3, 4)),
      update: jest.fn().mockResolvedValue(true),
    };

    const result = await new UpdateStockUseCase(repository).execute({ productId: 'product-id', quantity: 1 });

    expect(result).toMatchObject({ ok: true, value: { availableQuantity: 2, version: 5 } });
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({ availableQuantity: 2, version: 5 }), 4);
  });

  it('returns STOCK_NOT_FOUND when the product has no stock record', async () => {
    const repository = { findByProductId: jest.fn().mockResolvedValue(null), update: jest.fn() };

    const result = await new UpdateStockUseCase(repository).execute({ productId: 'missing', quantity: 1 });

    expect(result).toMatchObject({ ok: false, error: { code: 'STOCK_NOT_FOUND' } });
  });

  it('returns INSUFFICIENT_STOCK without attempting an update', async () => {
    const repository = {
      findByProductId: jest.fn().mockResolvedValue(stock(0, 2)),
      update: jest.fn(),
    };

    const result = await new UpdateStockUseCase(repository).execute({ productId: 'product-id', quantity: 1 });

    expect(result).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_STOCK' } });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('returns a conflict when a concurrent update changed the stock version', async () => {
    const repository = {
      findByProductId: jest.fn().mockResolvedValue(stock(3, 4)),
      update: jest.fn().mockResolvedValue(false),
    };

    const result = await new UpdateStockUseCase(repository).execute({ productId: 'product-id', quantity: 1 });

    expect(result).toMatchObject({ ok: false, error: { code: 'STOCK_VERSION_CONFLICT' } });
  });
});

function stock(availableQuantity: number, version: number): Stock {
  return new Stock({ id: 'stock-id', productId: 'product-id', availableQuantity, version, updatedAt: now });
}
