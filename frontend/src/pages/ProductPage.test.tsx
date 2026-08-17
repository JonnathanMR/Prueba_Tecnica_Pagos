import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import checkoutReducer from '../features/checkout/checkoutSlice'
import * as productsApi from '../features/products/productsApi'
import type { ProductSummary } from '../features/products/productsApi'
import { ProductPage } from './ProductPage'

vi.mock('../features/products/productsApi', () => ({
  fetchProducts: vi.fn(),
}))

const products: readonly ProductSummary[] = [
  {
    id: 'product-1',
    sku: 'AURORA-SPEAKER-001',
    name: 'Parlante Aurora Mini',
    description: 'Parlante Bluetooth portátil.',
    priceInCents: 8_990_000,
    currency: 'COP',
    availableQuantity: 11,
  },
  {
    id: 'product-2',
    sku: 'ORBIT-CHARGER-001',
    name: 'Cargador Orbit 30W',
    description: 'Cargador USB-C compacto.',
    priceInCents: 6_990_000,
    currency: 'COP',
    availableQuantity: 0,
  },
]

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderProductPage() {
  const store = configureStore({ reducer: { checkout: checkoutReducer } })
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProductPage />} />
          <Route path="/checkout" element={<Location />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return store
}

describe('ProductPage', () => {
  beforeEach(() => vi.mocked(productsApi.fetchProducts).mockReset())

  it('shows available products and sends the selected item to checkout', async () => {
    vi.mocked(productsApi.fetchProducts).mockResolvedValue(products)
    const user = userEvent.setup()
    const store = renderProductPage()

    expect(await screen.findByRole('heading', { name: 'Parlante Aurora Mini' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sin disponibilidad' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Comprar ahora' }))

    expect(store.getState().checkout.selectedProductId).toBe('product-1')
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout')
  })

  it('opens and closes the product image preview', async () => {
    vi.mocked(productsApi.fetchProducts).mockResolvedValue(products)
    const user = userEvent.setup()
    renderProductPage()

    await screen.findByRole('heading', { name: 'Parlante Aurora Mini' })
    await user.click(screen.getByRole('button', { name: 'Ver imagen ampliada de Parlante Aurora Mini' }))

    expect(screen.getByRole('dialog', { name: 'Parlante Aurora Mini' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error and retries the product request', async () => {
    vi.mocked(productsApi.fetchProducts)
      .mockRejectedValueOnce(new Error('Servicio no disponible'))
      .mockResolvedValueOnce(products)
    const user = userEvent.setup()
    renderProductPage()

    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Parlante Aurora Mini' })).toBeInTheDocument()
    expect(productsApi.fetchProducts).toHaveBeenCalledTimes(2)
  })
})
