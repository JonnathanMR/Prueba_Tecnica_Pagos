import type { Product } from '../../domain/product/product';
import type { ProductRepositoryPort } from '../../domain/product/product-repository.port';
import type { StockRepositoryPort } from '../../domain/stock/stock-repository.port';

export interface AvailableProduct {
  readonly product: Product;
  readonly availableQuantity: number;
}

export class ListProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly stockRepository: StockRepositoryPort,
  ) {}

  async execute(): Promise<readonly AvailableProduct[]> {
    const products = await this.productRepository.findActive();
    return Promise.all(
      products.map(async (product) => {
        const stock = await this.stockRepository.findByProductId(product.id);
        return { product, availableQuantity: stock?.availableQuantity ?? 0 };
      }),
    );
  }
}
