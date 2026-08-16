import { Customer } from '../../domain/customer/customer';
import { Delivery } from '../../domain/delivery/delivery';
import { Stock } from '../../domain/stock/stock';
import { PaymentTransaction, type PaymentTransactionStatus } from '../../domain/transaction/payment-transaction';
import { ProcessPaymentUseCase } from './process-payment.use-case';
import { UpdateStockUseCase } from './update-stock.use-case';

const now = new Date('2026-08-16T12:00:00.000Z');
const input = {
  transactionId: 'transaction-id', cardToken: 'card-token', installments: 1,
  paymentMethod: { type: 'CARD' as const, cardBrand: 'VISA' as const, cardLastFour: '4242' },
  acceptanceToken: 'acceptance-token', acceptPersonalAuth: 'personal-data-token', customerIp: '127.0.0.1',
};

describe('ProcessPaymentUseCase', () => {
  it('approves the transaction, updates stock and marks delivery ready', async () => {
    const dependencies = dependenciesFor('APPROVED');

    const result = await new ProcessPaymentUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: true, value: { stockUpdated: true, reused: false, transaction: { status: 'APPROVED' } } });
    expect(dependencies.paymentGateway.createCardPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountInCents: 106_500, customerEmail: 'ana@example.com', cardToken: 'card-token' }),
    );
    expect(dependencies.stockRepository.update).toHaveBeenCalledWith(expect.objectContaining({ availableQuantity: 2 }), 0);
    expect(dependencies.deliveryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'READY_FOR_SHIPMENT' }));
  });

  it('keeps stock unchanged when the provider leaves the payment pending', async () => {
    const dependencies = dependenciesFor('PENDING');

    const result = await new ProcessPaymentUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: true, value: { stockUpdated: false, transaction: { status: 'PENDING', providerTransactionId: 'provider-id' } } });
    expect(dependencies.stockRepository.update).not.toHaveBeenCalled();
    expect(dependencies.deliveryRepository.save).not.toHaveBeenCalled();
  });

  it('reuses a terminal transaction without invoking the provider again', async () => {
    const dependencies = dependenciesFor('APPROVED', transaction('APPROVED'));

    const result = await new ProcessPaymentUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: true, value: { reused: true, stockUpdated: false } });
    expect(dependencies.paymentGateway.createCardPayment).not.toHaveBeenCalled();
  });

  it('marks a declined payment without changing stock', async () => {
    const dependencies = dependenciesFor('DECLINED');

    const result = await new ProcessPaymentUseCase(dependencies).execute(input);

    expect(result).toMatchObject({ ok: true, value: { stockUpdated: false, transaction: { status: 'DECLINED', failureCode: 'CARD_DECLINED' } } });
    expect(dependencies.stockRepository.update).not.toHaveBeenCalled();
  });
});

function dependenciesFor(status: PaymentTransactionStatus, currentTransaction = transaction()) {
  const stockRepository = { findByProductId: jest.fn().mockResolvedValue(stock()), update: jest.fn().mockResolvedValue(true) };
  return {
    transactionRepository: {
      findById: jest.fn().mockResolvedValue(currentTransaction), findByReference: jest.fn(), findByIdempotencyKey: jest.fn(), save: jest.fn(),
    },
    customerRepository: { findById: jest.fn().mockResolvedValue(customer()), findByEmail: jest.fn(), save: jest.fn() },
    deliveryRepository: { findByTransactionId: jest.fn().mockResolvedValue(delivery()), save: jest.fn() },
    stockRepository,
    paymentGateway: {
      getAcceptanceData: jest.fn(), tokenizeCard: jest.fn(), findPayment: jest.fn(),
      createCardPayment: jest.fn().mockResolvedValue({
        providerTransactionId: 'provider-id', status,
        failureCode: status === 'DECLINED' ? 'CARD_DECLINED' : null,
        failureMessage: status === 'DECLINED' ? 'Card was declined.' : null,
      }),
    },
    updateStock: new UpdateStockUseCase(stockRepository),
    now: jest.fn(() => now),
  };
}

function transaction(status: PaymentTransactionStatus = 'PENDING'): PaymentTransaction {
  return new PaymentTransaction({
    id: 'transaction-id', reference: 'reference', productId: 'product-id', customerId: 'customer-id', status,
    productAmountInCents: 100_000, baseFeeInCents: 1_500, shippingFeeInCents: 5_000, totalAmountInCents: 106_500,
    providerTransactionId: status === 'APPROVED' ? 'provider-id' : null,
    paymentMethod: status === 'APPROVED' ? { type: 'CARD', cardBrand: 'VISA', cardLastFour: '4242' } : null,
    idempotencyKey: 'idem-key', failureCode: null, failureMessage: null, createdAt: now, updatedAt: now,
    processedAt: status === 'APPROVED' ? now : null,
  });
}

function customer(): Customer {
  return new Customer({ id: 'customer-id', fullName: 'Ana Pérez', email: 'ana@example.com', phone: '3001234567', documentType: null, documentNumber: null, createdAt: now, updatedAt: now });
}

function delivery(): Delivery {
  return new Delivery({ id: 'delivery-id', transactionId: 'transaction-id', recipientName: 'Ana Pérez', recipientPhone: '3001234567', addressLine1: 'Calle 10 # 20-30', addressLine2: null, city: 'Bogotá', department: 'Cundinamarca', country: 'CO', postalCode: null, status: 'PENDING', createdAt: now, updatedAt: now });
}

function stock(): Stock {
  return new Stock({ id: 'stock-id', productId: 'product-id', availableQuantity: 3, version: 0, updatedAt: now });
}
