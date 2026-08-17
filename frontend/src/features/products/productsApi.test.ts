import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchProducts } from './productsApi'

const product = {
  id: 'product-1',
  sku: 'AURORA-SPEAKER-001',
  name: 'Parlante Aurora Mini',
  description: 'Parlante Bluetooth portátil.',
  priceInCents: 8_990_000,
  currency: 'COP' as const,
  availableQuantity: 11,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('products API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the products response from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [product] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProducts()).resolves.toEqual([product])
    expect(fetchMock).toHaveBeenCalledWith('/api/products', { signal: undefined })
  })

  it('rejects failed and malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({}, 500)))
    await expect(fetchProducts()).rejects.toThrow('No pudimos cargar los productos. Inténtalo de nuevo.')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ data: {} })))
    await expect(fetchProducts()).rejects.toThrow('La respuesta de productos no tiene el formato esperado.')
  })
})
