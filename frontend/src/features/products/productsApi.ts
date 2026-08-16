export interface ProductSummary {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly description: string
  readonly priceInCents: number
  readonly currency: 'COP'
  readonly availableQuantity: number
}

interface ProductsResponse {
  readonly data: readonly ProductSummary[]
}

export async function fetchProducts(signal?: AbortSignal): Promise<readonly ProductSummary[]> {
  const response = await fetch('/api/products', { signal })
  if (!response.ok) throw new Error('No pudimos cargar los productos. Inténtalo de nuevo.')

  const payload = (await response.json()) as ProductsResponse
  if (!Array.isArray(payload.data)) throw new Error('La respuesta de productos no tiene el formato esperado.')

  return payload.data
}
