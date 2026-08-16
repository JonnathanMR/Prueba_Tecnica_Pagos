import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../App.css'
import fallbackProductImage from '../assets/hero.png'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { selectProduct } from '../features/checkout/checkoutSlice'
import { fetchProducts, type ProductSummary } from '../features/products/productsApi'

const productImages: Readonly<Record<string, string>> = {
  'AURORA-SPEAKER-001': '/parlante.jpg',
  'NIMBUS-HEADPHONES-001': '/audifonos.jpg',
  'ORBIT-CHARGER-001': '/cargador.jpg',
}

function formatCop(amountInCents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amountInCents / 100)
}

function imageForProduct(product: ProductSummary): string {
  return productImages[product.sku] ?? fallbackProductImage
}

export function ProductPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const selectedProductId = useAppSelector((state) => state.checkout.selectedProductId)
  const [products, setProducts] = useState<readonly ProductSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [previewProduct, setPreviewProduct] = useState<ProductSummary | null>(null)
  const closePreviewButton = useRef<HTMLButtonElement>(null)

  function loadProducts(): void {
    setIsLoading(true)
    setError(null)

    void fetchProducts()
      .then(setProducts)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los productos.'),
      )
      .finally(() => setIsLoading(false))
  }

  useEffect(() => loadProducts(), [])

  useEffect(() => {
    if (!previewProduct) return

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setPreviewProduct(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    closePreviewButton.current?.focus()
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [previewProduct])

  function continueToCheckout(product: ProductSummary): void {
    if (product.availableQuantity === 0) return
    dispatch(selectProduct(product.id))
    navigate('/checkout')
  }

  return (
    <main className="checkout-shell">
      <header className="checkout-header">
        <span className="brand" aria-label="pago simple">
          pago<span className="brand-mark">simple</span>
        </span>
        <span className="environment-label">Sandbox</span>
      </header>

      <p className="eyebrow">Paso 1 de 4</p>
      <h1 className="catalog-title">Elige tu producto</h1>
      <p className="catalog-description">Todos los precios incluyen IVA. Selecciona una opción para continuar.</p>

      {isLoading ? (
        <div className="product-grid" aria-label="Cargando productos">
          <ProductSkeleton />
          <ProductSkeleton />
          <ProductSkeleton />
        </div>
      ) : null}

      {!isLoading && error ? (
        <section aria-live="polite" className="product-feedback">
          <h1>No pudimos cargar el producto</h1>
          <p>{error}</p>
          <button className="button" type="button" onClick={loadProducts}>
            Reintentar
          </button>
        </section>
      ) : null}

      {!isLoading && !error && products.length > 0 ? (
        <section aria-label="Productos disponibles" className="product-grid">
          {products.map((product, index) => (
            <article
              key={product.id}
              className={`product-card product-card--catalog${selectedProductId === product.id ? ' product-card--selected' : ''}`}
            >
              <div className={`product-visual product-visual--${(index % 3) + 1}`}>
                <button
                  aria-label={`Ver imagen ampliada de ${product.name}`}
                  className="product-image-button"
                  type="button"
                  onClick={() => setPreviewProduct(product)}
                >
                  <img
                    alt=""
                    className="product-image"
                    src={imageForProduct(product)}
                    onError={({ currentTarget }) => {
                      currentTarget.onerror = null
                      currentTarget.src = fallbackProductImage
                    }}
                  />
                </button>
              </div>
              <div className="product-content">
                <p className="product-sku">{product.sku}</p>
                <h2>{product.name}</h2>
                <p className="product-description">{product.description}</p>
                <p className="product-price">{formatCop(product.priceInCents)}</p>
                <div className="product-stock" aria-label={`Disponibilidad: ${product.availableQuantity} unidades`}>
                  <span className={product.availableQuantity > 0 ? 'stock-dot' : 'stock-dot stock-dot--empty'} />
                  {product.availableQuantity > 0
                    ? `${product.availableQuantity} unidades disponibles`
                    : 'Producto agotado'}
                </div>
                <button
                  className="button product-action"
                  type="button"
                  disabled={product.availableQuantity === 0}
                  onClick={() => continueToCheckout(product)}
                >
                  {product.availableQuantity > 0 ? 'Comprar ahora' : 'Sin disponibilidad'}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!isLoading && !error && products.length === 0 ? (
        <section aria-live="polite" className="product-feedback">
          <h1>No hay productos disponibles</h1>
          <p>Vuelve a intentarlo más tarde.</p>
        </section>
      ) : null}

      {previewProduct ? (
        <div className="image-modal-backdrop" role="presentation" onMouseDown={() => setPreviewProduct(null)}>
          <section
            aria-labelledby="image-modal-title"
            aria-modal="true"
            className="image-modal"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="image-modal__header">
              <h2 id="image-modal-title">{previewProduct.name}</h2>
              <button
                ref={closePreviewButton}
                aria-label="Cerrar vista previa"
                className="image-modal__close"
                type="button"
                onClick={() => setPreviewProduct(null)}
              >
                ×
              </button>
            </div>
            <img
              alt={previewProduct.name}
              className="image-modal__image"
              src={imageForProduct(previewProduct)}
              onError={({ currentTarget }) => {
                currentTarget.onerror = null
                currentTarget.src = fallbackProductImage
              }}
            />
          </section>
        </div>
      ) : null}

      <p className="screen-footer">Pago seguro · Envío dentro de Colombia</p>
    </main>
  )
}

function ProductSkeleton() {
  return (
    <section className="product-card product-card--catalog product-card--loading">
      <div className="product-visual skeleton" />
      <div className="product-content">
        <span className="skeleton skeleton-line skeleton-line--short" />
        <span className="skeleton skeleton-line skeleton-line--title" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line skeleton-line--price" />
      </div>
    </section>
  )
}
