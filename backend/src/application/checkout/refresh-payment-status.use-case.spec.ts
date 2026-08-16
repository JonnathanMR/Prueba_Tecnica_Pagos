import { Delivery } from '../../domain/delivery/delivery';
import { Stock } from '../../domain/stock/stock';
import { PaymentTransaction, type PaymentTransactionStatus } from '../../domain/transaction/payment-transaction';
import { RefreshPaymentStatusUseCase } from './refresh-payment-status.use-case';
import { UpdateStockUseCase } from './update-stock.use-case';

const now = new Date('2026-08-16T12:00:00.000Z');

describe('RefreshPaymentStatusUseCase', () => {
  it('keeps a transaction pending while the provider is still processing it', async () => {
    const dependencies = dependenciesFor('PENDING');

    const result = await new RefreshPaymentStatusUseCase(dependencies).execute('transaction-id');

    expect(result).toMatchObject({ ok: true, value: { stockUpdated: false, transaction: { status: 'PENDING' } } });
    expect(dependencies.stockRepository.update).not.toHaveBeenCalled();
  });

  it('approves the pending transaction and updates stock when the provider approves it', async () => {
    const dependencies = dependenciesFor('APPROVED');

    const result = await new RefreshPaymentStatusUseCase(dependencies).execute('transaction-id');

    expect(result).toMatchObject({ ok: true, value: { stockUpdated: true, transaction: { status: 'APPROVED' } } });
    expect(dependencies.stockRepository.update).toHaveBeenCalledWith(expect.objectContaining({ availableQuantity: 2 }), 0);
    expect(dependencies.deliveryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'READY_FOR_SHIPMENT' }));
  });

  it('records a declined provider status without changing stock', async () => {
    const dependencies = dependenciesFor('DECLINED');

    const result = await new RefreshPaymentStatusUseCase(dependencies).execute('transaction-id');

    expect(result).toMatchObject({ ok: true, value: { stockUpdated: false, transaction: { status: 'DECLINED' } } });
    expect(dependencies.stockRepository.update).not.toHaveBeenCalled();
  });
});

function dependenciesFor(status: PaymentTransactionStatus) {
  const stockRepository = { findByProductId: jest.fn().mockResolvedValue(stock()), update: jest.fn().mockResolvedValue(true) };
  return {
    transactionRepository: { findById: jest.fn().mockResolvedValue(transaction()), findByReference: jest.fn(), findByIdempotencyKey: jest.fn(), save: jest.fn() },
    deliveryRepository: { findByTransactionId: jest.fn().mockResolvedValue(delivery()), save: jest.fn() },
    stockRepository,
    paymentGateway: { getAcceptanceData: jest.fn(), tokenizeCard: jest.fn(), createCardPayment: jest.fn(), findPayment: jest.fn().mockResolvedValue({ providerTransactionId: 'provider-id', status, failureCode: status === 'DECLINED' ? 'CARD_DECLINED' : null, failureMessage: null }) },
    updateStock: new UpdateStockUseCase(stockRepository),
    now: jest.fn(() => now),
  };
}

function transaction(): PaymentTransaction {
  return new PaymentTransaction({
    id: 'transaction-id', reference: 'reference', productId: 'product-id', customerId: 'customer-id', status: 'PENDING',
    productAmountInCents: 100_000, baseFeeInCents: 1_500, shippingFeeInCents: 5_000, totalAmountInCents: 106_500,
    providerTransactionId: 'provider-id', paymentMethod: { type: 'CARD', cardBrand: 'VISA', cardLastFour: '4242' },
    idempotencyKey: 'idem-key', failureCode: null, failureMessage: null, createdAt: now, updatedAt: now, processedAt: null,
  });
}

function delivery(): Delivery {
  return new Delivery({
    id: 'delivery-id', transactionId: 'transaction-id', recipientName: 'Ana Pérez', recipientPhone: '3001234567',
    addressLine1: 'Calle 10 # 20-30', addressLine2: null, city: 'Bogotá', department: 'Cundinamarca', country: 'CO', postalCode: null, status: 'PENDING', createdAt: now, updatedAt: now,
  });
}

function stock(): Stock {
  return new Stock({ id: 'stock-id', productId: 'product-id', availableQuantity: 3, version: 0, updatedAt: now });
}
