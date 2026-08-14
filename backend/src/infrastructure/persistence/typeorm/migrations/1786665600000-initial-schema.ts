import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1786665600000 implements MigrationInterface {
  name = 'InitialSchema1786665600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TYPE payment_transaction_status AS ENUM (
        'PENDING', 'APPROVED', 'DECLINED', 'ERROR', 'VOIDED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE delivery_status AS ENUM (
        'PENDING', 'READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku varchar(64) NOT NULL UNIQUE,
        name varchar(160) NOT NULL,
        description text NOT NULL,
        price_in_cents bigint NOT NULL CHECK (price_in_cents > 0),
        currency char(3) NOT NULL DEFAULT 'COP' CHECK (currency = 'COP'),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE stock (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL UNIQUE REFERENCES products(id),
        available_quantity integer NOT NULL CHECK (available_quantity >= 0),
        version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE customers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name varchar(160) NOT NULL,
        email varchar(254) NOT NULL UNIQUE,
        phone varchar(32) NOT NULL,
        document_type varchar(16),
        document_number varchar(32),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE payment_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference varchar(64) NOT NULL UNIQUE,
        product_id uuid NOT NULL REFERENCES products(id),
        customer_id uuid NOT NULL REFERENCES customers(id),
        status payment_transaction_status NOT NULL DEFAULT 'PENDING',
        product_amount_in_cents bigint NOT NULL CHECK (product_amount_in_cents > 0),
        base_fee_in_cents bigint NOT NULL CHECK (base_fee_in_cents >= 0),
        shipping_fee_in_cents bigint NOT NULL CHECK (shipping_fee_in_cents >= 0),
        total_amount_in_cents bigint NOT NULL CHECK (total_amount_in_cents > 0),
        provider_transaction_id varchar(128) UNIQUE,
        payment_method_type varchar(32),
        card_brand varchar(24),
        card_last_four char(4),
        idempotency_key uuid NOT NULL UNIQUE,
        failure_code varchar(64),
        failure_message varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        CONSTRAINT payment_transaction_total_matches_components
          CHECK (total_amount_in_cents = product_amount_in_cents + base_fee_in_cents + shipping_fee_in_cents)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id uuid NOT NULL UNIQUE REFERENCES payment_transactions(id),
        recipient_name varchar(160) NOT NULL,
        recipient_phone varchar(32) NOT NULL,
        address_line_1 varchar(255) NOT NULL,
        address_line_2 varchar(255),
        city varchar(100) NOT NULL,
        department varchar(100) NOT NULL,
        country char(2) NOT NULL DEFAULT 'CO',
        postal_code varchar(16),
        status delivery_status NOT NULL DEFAULT 'PENDING',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX idx_payment_transactions_product_id ON payment_transactions(product_id)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_payment_transactions_customer_id ON payment_transactions(customer_id)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_payment_transactions_status ON payment_transactions(status)',
    );
    await queryRunner.query('CREATE INDEX idx_deliveries_status ON deliveries(status)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE deliveries');
    await queryRunner.query('DROP TABLE payment_transactions');
    await queryRunner.query('DROP TABLE customers');
    await queryRunner.query('DROP TABLE stock');
    await queryRunner.query('DROP TABLE products');
    await queryRunner.query('DROP TYPE delivery_status');
    await queryRunner.query('DROP TYPE payment_transaction_status');
  }
}
