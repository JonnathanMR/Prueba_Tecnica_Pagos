import { Delivery } from '../../domain/delivery/delivery';
import { PaymentTransaction } from '../../domain/transaction/payment-transaction';
import { GetTransactionUseCase } from './get-transaction.use-case';

const now = new Date('2026-08-16T12:00:00.000Z');

describe('GetTransactionUseCase', () => {
  it('returns the transaction with its delivery', async () => {
    const paymentTransaction = transaction();
    const transactionRepository = transactionRepositoryFor(paymentTransaction);
    const deliveryRepository = deliveryRepositoryFor(delivery());

    const result = await new GetTransactionUseCase(transactionRepository, deliveryRepository).execute('transaction-id');

    expect(result).toMatchObject({ ok: true, value: { transaction: paymentTransaction, delivery: expect.any(Delivery) } });
  });

  it('returns TRANSACTION_NOT_FOUND when there is no matching transaction', async () => {
    const transactionRepository = transactionRepositoryFor(null);
    const deliveryRepository = deliveryRepositoryFor(null);

    const result = await new GetTransactionUseCase(transactionRepository, deliveryRepository).execute('missing-id');

    expect(result).toMatchObject({ ok: false, error: { code: 'TRANSACTION_NOT_FOUND' } });
    expect(deliveryRepository.findByTransactionId).not.toHaveBeenCalled();
  });

  it('returns DELIVERY_NOT_FOUND when the transaction is incomplete', async () => {
    const transactionRepository = transactionRepositoryFor(transaction());
    const deliveryRepository = deliveryRepositoryFor(null);

    const result = await new GetTransactionUseCase(transactionRepository, deliveryRepository).execute('transaction-id');

    expect(result).toMatchObject({ ok: false, error: { code: 'DELIVERY_NOT_FOUND' } });
  });
});

function transaction(): PaymentTransaction {
  return new PaymentTransaction({
    id: 'transaction-id', reference: 'reference', productId: 'product-id', customerId: 'customer-id', status: 'PENDING',
    productAmountInCents: 100_000, baseFeeInCents: 1_500, shippingFeeInCents: 5_000, totalAmountInCents: 106_500,
    providerTransactionId: null, paymentMethod: null, idempotencyKey: 'idem-key', failureCode: null, failureMessage: null,
    createdAt: now, updatedAt: now, processedAt: null,
  });
}

function transactionRepositoryFor(value: PaymentTransaction | null) {
  return {
    findById: jest.fn().mockResolvedValue(value),
    findByReference: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    save: jest.fn(),
  };
}

function deliveryRepositoryFor(value: Delivery | null) {
  return { findByTransactionId: jest.fn().mockResolvedValue(value), save: jest.fn() };
}

function delivery(): Delivery {
  return new Delivery({
    id: 'delivery-id', transactionId: 'transaction-id', recipientName: 'Ana Pérez', recipientPhone: '3001234567',
    addressLine1: 'Calle 10 # 20-30', addressLine2: null, city: 'Bogotá', department: 'Cundinamarca', country: 'CO',
    postalCode: null, status: 'PENDING', createdAt: now, updatedAt: now,
  });
}
