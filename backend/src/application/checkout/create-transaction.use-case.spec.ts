import { CreateTransactionUseCase } from './create-transaction.use-case';
import { Delivery } from '../../domain/delivery/delivery';
import { Product } from '../../domain/product/product';
import { Stock } from '../../domain/stock/stock';
import { PaymentTransaction } from '../../domain/transaction/payment-transaction';

const now = new Date('2026-08-16T12:00:00.000Z');

describe('CreateTransactionUseCase', () => {
  const input = {
    productId: 'product-id',
    idempotencyKey: 'idem-key',
    baseFeeInCents: 1_500,
    shippingFeeInCents: 5_000,
    customer: {
      fullName: 'Ana Pérez',
      email: ' ANA@example.com ',
      phone: '3001234567',
      documentType: null,
      documentNumber: null,
    },
    delivery: {
      recipientName: 'Ana Pérez',
      recipientPhone: '3001234567',
      addressLine1: 'Calle 10 # 20-30',
      addressLine2: null,
      city: 'Bogotá',
      department: 'Cundinamarca',
      country: 'CO' as const,
      postalCode: null,
    },
  };

  it('creates a pending transaction and its delivery with the product price', async () => {
    const dependencies = dependenciesFor();
    dependencies.productRepository.findById.mockResolvedValue(product());
    dependencies.stockRepository.findByProductId.mockResolvedValue(stock());
    dependencies.customerRepository.findByEmail.mockResolvedValue(null);

    const result = await new CreateTransactionUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;

    expect(result.value.reused).toBe(false);
    expect(result.value.transaction).toMatchObject({
      id: 'transaction-id',
      status: 'PENDING',
      productAmountInCents: 100_000,
      totalAmountInCents: 106_500,
    });
    expect(result.value.delivery).toMatchObject({
      id: 'delivery-id',
      transactionId: 'transaction-id',
      status: 'PENDING',
    });
    expect(dependencies.customerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'customer-id', email: 'ana@example.com' }),
    );
    expect(dependencies.transactionRepository.save).toHaveBeenCalledWith(result.value.transaction);
    expect(dependencies.deliveryRepository.save).toHaveBeenCalledWith(result.value.delivery);
  });

  it('returns the existing transaction when the idempotency key was already used', async () => {
    const dependencies = dependenciesFor();
    const existing = transaction();
    const existingDelivery = delivery(existing.id);
    dependencies.transactionRepository.findByIdempotencyKey.mockResolvedValue(existing);
    dependencies.deliveryRepository.findByTransactionId.mockResolvedValue(existingDelivery);

    const result = await new CreateTransactionUseCase(dependencies).execute(input);

    expect(result).toEqual({ ok: true, value: { transaction: existing, delivery: existingDelivery, reused: true } });
    expect(dependencies.productRepository.findById).not.toHaveBeenCalled();
    expect(dependencies.transactionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an unavailable product before creating customer data', async () => {
    const dependencies = dependenciesFor();
    dependencies.productRepository.findById.mockResolvedValue(product({ isActive: false }));

    const result = await new CreateTransactionUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: false, error: { code: 'PRODUCT_INACTIVE' } });
    expect(dependencies.customerRepository.save).not.toHaveBeenCalled();
    expect(dependencies.transactionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects creation when there is no available stock', async () => {
    const dependencies = dependenciesFor();
    dependencies.productRepository.findById.mockResolvedValue(product());
    dependencies.stockRepository.findByProductId.mockResolvedValue(stock({ availableQuantity: 0 }));

    const result = await new CreateTransactionUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: false, error: { code: 'OUT_OF_STOCK' } });
    expect(dependencies.transactionRepository.save).not.toHaveBeenCalled();
  });
});

function dependenciesFor() {
  const ids = ['customer-id', 'transaction-id', 'delivery-id'];
  return {
    productRepository: {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findActive: jest.fn(),
    },
    stockRepository: { findByProductId: jest.fn(), update: jest.fn() },
    customerRepository: { findById: jest.fn(), findByEmail: jest.fn(), save: jest.fn() },
    deliveryRepository: { findByTransactionId: jest.fn(), save: jest.fn() },
    transactionRepository: {
      findById: jest.fn(),
      findByReference: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      save: jest.fn(),
    },
    generateId: jest.fn(() => ids.shift() ?? 'unexpected-id'),
    generateReference: jest.fn(() => 'payment-reference'),
    now: jest.fn(() => now),
  };
}

function product(overrides: Partial<{ isActive: boolean }> = {}): Product {
  return new Product({
    id: 'product-id',
    sku: 'SKU-001',
    name: 'Product',
    description: 'Description',
    priceInCents: 100_000,
    currency: 'COP',
    isActive: overrides.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });
}

function stock(overrides: Partial<{ availableQuantity: number }> = {}): Stock {
  return new Stock({
    id: 'stock-id',
    productId: 'product-id',
    availableQuantity: overrides.availableQuantity ?? 3,
    version: 0,
    updatedAt: now,
  });
}

function transaction(): PaymentTransaction {
  return new PaymentTransaction({
    id: 'existing-transaction-id', reference: 'existing-reference', productId: 'product-id', customerId: 'customer-id',
    status: 'PENDING', productAmountInCents: 100_000, baseFeeInCents: 1_500, shippingFeeInCents: 5_000,
    totalAmountInCents: 106_500, providerTransactionId: null, paymentMethod: null, idempotencyKey: 'idem-key',
    failureCode: null, failureMessage: null, createdAt: now, updatedAt: now, processedAt: null,
  });
}

function delivery(transactionId: string): Delivery {
  return new Delivery({
    id: 'delivery-id', transactionId, recipientName: 'Ana Pérez', recipientPhone: '3001234567',
    addressLine1: 'Calle 10 # 20-30', addressLine2: null, city: 'Bogotá', department: 'Cundinamarca',
    country: 'CO', postalCode: null, status: 'PENDING', createdAt: now, updatedAt: now,
  });
}
