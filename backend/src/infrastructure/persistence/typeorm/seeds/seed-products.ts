import { appDataSource } from '../data-source';

interface SeedProduct {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly availableQuantity: number;
}

const products: readonly SeedProduct[] = [
  {
    sku: 'AURORA-SPEAKER-001',
    name: 'Parlante Aurora Mini',
    description: 'Parlante Bluetooth portátil con 12 horas de batería.',
    priceInCents: 8_990_000,
    availableQuantity: 12,
  },
  {
    sku: 'NIMBUS-HEADPHONES-001',
    name: 'Audífonos Nimbus',
    description: 'Audífonos inalámbricos con cancelación pasiva de ruido.',
    priceInCents: 14_990_000,
    availableQuantity: 8,
  },
  {
    sku: 'ORBIT-CHARGER-001',
    name: 'Cargador Orbit 30W',
    description: 'Cargador USB-C compacto con carga rápida de 30W.',
    priceInCents: 6_490_000,
    availableQuantity: 20,
  },
];

async function seedProducts(): Promise<void> {
  await appDataSource.initialize();

  try {
    for (const product of products) {
      const [savedProduct] = await appDataSource.query<{ id: string }[]>(
        `
          INSERT INTO products (sku, name, description, price_in_cents)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (sku) DO UPDATE
            SET name = EXCLUDED.name,
                description = EXCLUDED.description,
                price_in_cents = EXCLUDED.price_in_cents,
                updated_at = now()
          RETURNING id
        `,
        [product.sku, product.name, product.description, product.priceInCents],
      );

      await appDataSource.query(
        `
          INSERT INTO stock (product_id, available_quantity)
          VALUES ($1, $2)
          ON CONFLICT (product_id) DO UPDATE
            SET available_quantity = EXCLUDED.available_quantity,
                updated_at = now()
        `,
        [savedProduct.id, product.availableQuantity],
      );
    }
  } finally {
    await appDataSource.destroy();
  }
}

void seedProducts().catch((error: unknown) => {
  console.error('Unable to seed products.', error);
  process.exitCode = 1;
});
