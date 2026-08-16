import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ListProductsUseCase } from '../../application/catalog/list-products.use-case';

@Controller('products')
@ApiTags('Products')
export class ProductsController {
  constructor(private readonly listProducts: ListProductsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List active products' })
  @ApiOkResponse({ description: 'Returns the products available for purchase.' })
  async list(): Promise<{ data: readonly ProductResponse[] }> {
    const products = await this.listProducts.execute();
    return { data: products.map(toProductResponse) };
  }
}

interface ProductResponse {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly currency: 'COP';
}

function toProductResponse(product: Awaited<ReturnType<ListProductsUseCase['execute']>>[number]): ProductResponse {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    priceInCents: product.priceInCents,
    currency: product.currency,
  };
}
