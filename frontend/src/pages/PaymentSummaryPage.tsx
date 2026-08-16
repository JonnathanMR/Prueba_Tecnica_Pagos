import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import '../App.css'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { baseFeeInCents, formatCop, shippingFeeInCents } from '../features/checkout/checkoutCosts'
import { moveToStep } from '../features/checkout/checkoutSlice'
import { fetchProducts, type ProductSummary } from '../features/products/productsApi'

const progressItems = [
  { label: 'Producto', to: '/' },
  { label: 'Pago', to: '/checkout' },
  { label: 'Resumen', to: '/summary' },
  { label: 'Resultado', to: '/payment-result' },
]

export function PaymentSummaryPage() {
  const dispatch = useAppDispatch()
  const selectedProductId = useAppSelector((state) => state.checkout.selectedProductId)
  const delivery = useAppSelector((state) => state.checkout.delivery)
  const payment = useAppSelector((state) => state.checkout.payment)
  const [product, setProduct] = useState<ProductSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    dispatch(moveToStep('summary'))
  }, [dispatch])

  useEffect(() => {
    if (!selectedProductId) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    void fetchProducts(controller.signal)
      .then((products) => {
        const selectedProduct = products.find((item) => item.id === selectedProductId) ?? null
        setProduct(selectedProduct)
        if (!selectedProduct) setError('El producto seleccionado ya no está disponible.')
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar el resumen.')
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [selectedProductId])

  const isDeliveryComplete = Object.values(delivery).every((value) => value.trim().length > 0)
  const hasPaymentMethod = payment.cardBrand !== null && payment.cardLastFour !== null

  return (
    <main className="checkout-shell">
      <header className="checkout-header">
        <Link className="brand" to="/">
          pago<span className="brand-mark">simple</span>
        </Link>
        <span className="environment-label">Sandbox</span>
      </header>

      <nav aria-label="Progreso del checkout">
        <ol className="progress-list">
          {progressItems.map((item) => (
            <li key={item.to}>
              <NavLink className={({ isActive }) => `progress-link${isActive ? ' progress-link--active' : ''}`} to={item.to}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <p className="eyebrow">Paso 3 de 4</p>
      <h1 className="checkout-form-title">Resumen de tu compra</h1>
      <p className="checkout-form-intro">Revisa la información antes de confirmar el pago.</p>

      {!selectedProductId || !isDeliveryComplete || !hasPaymentMethod ? (
        <section aria-live="polite" className="summary-feedback">
          <h2>Falta información para mostrar el resumen</h2>
          <p>Selecciona un producto y completa los datos de pago y entrega.</p>
          <Link className="button" to={selectedProductId ? '/checkout' : '/'}>
            {selectedProductId ? 'Completar pago y entrega' : 'Elegir un producto'}
          </Link>
        </section>
      ) : null}

      {selectedProductId && isDeliveryComplete && hasPaymentMethod ? (
        <div className="summary-layout">
          <section aria-labelledby="order-summary-title" className="summary-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Pedido</p>
                <h2 id="order-summary-title">Detalle de compra</h2>
              </div>
              <Link className="text-button" to="/">Cambiar</Link>
            </div>

            {isLoading ? <p className="summary-loading">Cargando producto…</p> : null}
            {!isLoading && error ? <p className="field-error">{error}</p> : null}
            {!isLoading && product ? (
              <>
                <div className="summary-product">
                  <div aria-hidden="true" className="summary-product__image">▣</div>
                  <div>
                    <p className="product-sku">{product.sku}</p>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                  </div>
                  <strong>{formatCop(product.priceInCents)}</strong>
                </div>

                <dl className="amount-list">
                  <div>
                    <dt>Producto</dt>
                    <dd>{formatCop(product.priceInCents)}</dd>
                  </div>
                  <div>
                    <dt>Tarifa base</dt>
                    <dd>{formatCop(baseFeeInCents)}</dd>
                  </div>
                  <div>
                    <dt>Envío</dt>
                    <dd>{formatCop(shippingFeeInCents)}</dd>
                  </div>
                  <div className="amount-list__total">
                    <dt>Total a pagar</dt>
                    <dd>{formatCop(product.priceInCents + baseFeeInCents + shippingFeeInCents)}</dd>
                  </div>
                </dl>
              </>
            ) : null}
          </section>

          <div className="summary-details">
            <section aria-labelledby="delivery-summary-title" className="summary-card">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Entrega</p>
                  <h2 id="delivery-summary-title">Dirección de envío</h2>
                </div>
                <Link className="text-button" to="/checkout">Editar</Link>
              </div>
              <p className="summary-recipient">{delivery.recipientName}</p>
              <p className="summary-detail">{delivery.addressLine1}</p>
              <p className="summary-detail">{delivery.city}, {delivery.department}</p>
              <p className="summary-detail">Cel. {delivery.phone}</p>
            </section>

            {payment.cardBrand && payment.cardLastFour ? (
              <section aria-labelledby="payment-summary-title" className="summary-card">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Método de pago</p>
                    <h2 id="payment-summary-title">Tarjeta</h2>
                  </div>
                  <Link className="text-button" to="/checkout">Editar</Link>
                </div>
                <div className="saved-card">
                  <span className={`card-brand card-brand--${payment.cardBrand.toLowerCase()}`}>{payment.cardBrand}</span>
                  <span>•••• {payment.cardLastFour}</span>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="summary-next-step">
            <strong>El pago se confirmará en el siguiente paso.</strong>
            <p>La integración de la transacción y el resultado real se conectarán en el flujo end-to-end.</p>
          </aside>
        </div>
      ) : null}

      <p className="screen-footer">Los valores se muestran en pesos colombianos e incluyen los cargos indicados.</p>
    </main>
  )
}
