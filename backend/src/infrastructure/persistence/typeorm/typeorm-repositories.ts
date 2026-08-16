import { DataSource } from 'typeorm';

import { Customer } from '../../../domain/customer/customer';
import type { CustomerRepositoryPort } from '../../../domain/customer/customer-repository.port';
import { Delivery, type DeliveryStatus } from '../../../domain/delivery/delivery';
import type { DeliveryRepositoryPort } from '../../../domain/delivery/delivery-repository.port';
import { Product } from '../../../domain/product/product';
import type { ProductRepositoryPort } from '../../../domain/product/product-repository.port';
import type { EntityId } from '../../../domain/shared/entity-id';
import { Stock } from '../../../domain/stock/stock';
import type { StockRepositoryPort } from '../../../domain/stock/stock-repository.port';
import {
  PaymentTransaction,
  type CardBrand,
  type PaymentMethodSnapshot,
  type PaymentTransactionStatus,
} from '../../../domain/transaction/payment-transaction';
import type { PaymentTransactionRepositoryPort } from '../../../domain/transaction/payment-transaction-repository.port';

type DatabaseValue = string | number | boolean | Date | null;

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string;
  price_in_cents: DatabaseValue;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface StockRow {
  id: string;
  product_id: string;
  available_quantity: DatabaseValue;
  version: DatabaseValue;
  updated_at: Date;
}

interface CustomerRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  document_type: string | null;
  document_number: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DeliveryRow {
  id: string;
  transaction_id: string;
  recipient_name: string;
  recipient_phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  department: string;
  country: 'CO';
  postal_code: string | null;
  status: DeliveryStatus;
  created_at: Date;
  updated_at: Date;
}

interface TransactionRow {
  id: string;
  reference: string;
  product_id: string;
  customer_id: string;
  status: PaymentTransactionStatus;
  product_amount_in_cents: DatabaseValue;
  base_fee_in_cents: DatabaseValue;
  shipping_fee_in_cents: DatabaseValue;
  total_amount_in_cents: DatabaseValue;
  provider_transaction_id: string | null;
  payment_method_type: 'CARD' | null;
  card_brand: CardBrand | null;
  card_last_four: string | null;
  idempotency_key: string;
  failure_code: string | null;
  failure_message: string | null;
  created_at: Date;
  updated_at: Date;
  processed_at: Date | null;
}

export class TypeOrmProductRepository implements ProductRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: EntityId): Promise<Product | null> {
    const [row] = await this.query<ProductRow>('SELECT * FROM products WHERE id = $1', [id]);
    return row ? toProduct(row) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const [row] = await this.query<ProductRow>('SELECT * FROM products WHERE sku = $1', [sku]);
    return row ? toProduct(row) : null;
  }

  async findActive(): Promise<readonly Product[]> {
    const rows = await this.query<ProductRow>(
      'SELECT * FROM products WHERE is_active = true ORDER BY created_at ASC',
    );
    return rows.map(toProduct);
  }

  private async query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    return this.dataSource.query(sql, values) as Promise<T[]>;
  }
}

export class TypeOrmStockRepository implements StockRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async findByProductId(productId: EntityId): Promise<Stock | null> {
    const rows = (await this.dataSource.query('SELECT * FROM stock WHERE product_id = $1', [
      productId,
    ])) as StockRow[];
    return rows[0] ? toStock(rows[0]) : null;
  }

  async update(stock: Stock, expectedVersion: number): Promise<boolean> {
    const result = (await this.dataSource.query(
      `UPDATE stock
       SET available_quantity = $1, version = $2, updated_at = $3
       WHERE id = $4 AND version = $5`,
      [stock.availableQuantity, stock.version, stock.updatedAt, stock.id, expectedVersion],
    )) as [unknown[], number];
    return result[1] === 1;
  }
}

export class TypeOrmCustomerRepository implements CustomerRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: EntityId): Promise<Customer | null> {
    const rows = (await this.dataSource.query('SELECT * FROM customers WHERE id = $1', [id])) as CustomerRow[];
    return rows[0] ? toCustomer(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const rows = (await this.dataSource.query('SELECT * FROM customers WHERE email = $1', [email])) as CustomerRow[];
    return rows[0] ? toCustomer(rows[0]) : null;
  }

  async save(customer: Customer): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO customers (
        id, full_name, email, phone, document_type, document_number, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        document_type = EXCLUDED.document_type,
        document_number = EXCLUDED.document_number,
        updated_at = EXCLUDED.updated_at`,
      [
        customer.id,
        customer.fullName,
        customer.email,
        customer.phone,
        customer.documentType,
        customer.documentNumber,
        customer.createdAt,
        customer.updatedAt,
      ],
    );
  }
}

export class TypeOrmDeliveryRepository implements DeliveryRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async findByTransactionId(transactionId: EntityId): Promise<Delivery | null> {
    const rows = (await this.dataSource.query('SELECT * FROM deliveries WHERE transaction_id = $1', [
      transactionId,
    ])) as DeliveryRow[];
    return rows[0] ? toDelivery(rows[0]) : null;
  }

  async save(delivery: Delivery): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO deliveries (
        id, transaction_id, recipient_name, recipient_phone, address_line_1, address_line_2,
        city, department, country, postal_code, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        recipient_name = EXCLUDED.recipient_name,
        recipient_phone = EXCLUDED.recipient_phone,
        address_line_1 = EXCLUDED.address_line_1,
        address_line_2 = EXCLUDED.address_line_2,
        city = EXCLUDED.city,
        department = EXCLUDED.department,
        country = EXCLUDED.country,
        postal_code = EXCLUDED.postal_code,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at`,
      [
        delivery.id,
        delivery.transactionId,
        delivery.recipientName,
        delivery.recipientPhone,
        delivery.addressLine1,
        delivery.addressLine2,
        delivery.city,
        delivery.department,
        delivery.country,
        delivery.postalCode,
        delivery.status,
        delivery.createdAt,
        delivery.updatedAt,
      ],
    );
  }
}

export class TypeOrmPaymentTransactionRepository implements PaymentTransactionRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: EntityId): Promise<PaymentTransaction | null> {
    const rows = (await this.dataSource.query('SELECT * FROM payment_transactions WHERE id = $1', [
      id,
    ])) as TransactionRow[];
    return rows[0] ? toTransaction(rows[0]) : null;
  }

  async findByReference(reference: string): Promise<PaymentTransaction | null> {
    const rows = (await this.dataSource.query('SELECT * FROM payment_transactions WHERE reference = $1', [
      reference,
    ])) as TransactionRow[];
    return rows[0] ? toTransaction(rows[0]) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PaymentTransaction | null> {
    const rows = (await this.dataSource.query(
      'SELECT * FROM payment_transactions WHERE idempotency_key = $1',
      [idempotencyKey],
    )) as TransactionRow[];
    return rows[0] ? toTransaction(rows[0]) : null;
  }

  async save(transaction: PaymentTransaction): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO payment_transactions (
        id, reference, product_id, customer_id, status, product_amount_in_cents, base_fee_in_cents,
        shipping_fee_in_cents, total_amount_in_cents, provider_transaction_id, payment_method_type,
        card_brand, card_last_four, idempotency_key, failure_code, failure_message, created_at,
        updated_at, processed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        provider_transaction_id = EXCLUDED.provider_transaction_id,
        payment_method_type = EXCLUDED.payment_method_type,
        card_brand = EXCLUDED.card_brand,
        card_last_four = EXCLUDED.card_last_four,
        failure_code = EXCLUDED.failure_code,
        failure_message = EXCLUDED.failure_message,
        updated_at = EXCLUDED.updated_at,
        processed_at = EXCLUDED.processed_at`,
      [
        transaction.id,
        transaction.reference,
        transaction.productId,
        transaction.customerId,
        transaction.status,
        transaction.productAmountInCents,
        transaction.baseFeeInCents,
        transaction.shippingFeeInCents,
        transaction.totalAmountInCents,
        transaction.providerTransactionId,
        transaction.paymentMethod?.type ?? null,
        transaction.paymentMethod?.cardBrand ?? null,
        transaction.paymentMethod?.cardLastFour ?? null,
        transaction.idempotencyKey,
        transaction.failureCode,
        transaction.failureMessage,
        transaction.createdAt,
        transaction.updatedAt,
        transaction.processedAt,
      ],
    );
  }
}

function toProduct(row: ProductRow): Product {
  return new Product({
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceInCents: asSafeInteger(row.price_in_cents, 'product price'),
    currency: 'COP',
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function toStock(row: StockRow): Stock {
  return new Stock({
    id: row.id,
    productId: row.product_id,
    availableQuantity: asSafeInteger(row.available_quantity, 'available quantity'),
    version: asSafeInteger(row.version, 'stock version'),
    updatedAt: new Date(row.updated_at),
  });
}

function toCustomer(row: CustomerRow): Customer {
  return new Customer({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    documentType: row.document_type,
    documentNumber: row.document_number,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function toDelivery(row: DeliveryRow): Delivery {
  return new Delivery({
    id: row.id,
    transactionId: row.transaction_id,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    department: row.department,
    country: row.country,
    postalCode: row.postal_code,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function toTransaction(row: TransactionRow): PaymentTransaction {
  const paymentMethod: PaymentMethodSnapshot | null =
    row.payment_method_type === 'CARD' && row.card_brand && row.card_last_four
      ? { type: 'CARD', cardBrand: row.card_brand, cardLastFour: row.card_last_four }
      : null;

  return new PaymentTransaction({
    id: row.id,
    reference: row.reference,
    productId: row.product_id,
    customerId: row.customer_id,
    status: row.status,
    productAmountInCents: asSafeInteger(row.product_amount_in_cents, 'product amount'),
    baseFeeInCents: asSafeInteger(row.base_fee_in_cents, 'base fee'),
    shippingFeeInCents: asSafeInteger(row.shipping_fee_in_cents, 'shipping fee'),
    totalAmountInCents: asSafeInteger(row.total_amount_in_cents, 'total amount'),
    providerTransactionId: row.provider_transaction_id,
    paymentMethod,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : null,
  });
}

function asSafeInteger(value: DatabaseValue, field: string): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`Database ${field} is not a safe integer.`);
  }
  return numberValue;
}
