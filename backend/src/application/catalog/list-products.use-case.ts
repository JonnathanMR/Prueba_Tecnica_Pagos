import type { Product } from '../../domain/product/product';
import type { ProductRepositoryPort } from '../../domain/product/product-repository.port';

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepositoryPort) {}

  execute(): Promise<readonly Product[]> {
    return this.productRepository.findActive();
  }
}
