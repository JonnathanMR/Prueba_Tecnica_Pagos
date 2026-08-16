import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import '../App.css'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  createTransaction,
  getAcceptanceData,
  processPayment,
  type AcceptanceData,
} from '../features/checkout/checkoutApi'
import { baseFeeInCents, formatCop, shippingFeeInCents } from '../features/checkout/checkoutCosts'
import { moveToStep, saveTransactionDraft } from '../features/checkout/checkoutSlice'
import {
  clearEphemeralPaymentSession,
  getEphemeralPaymentSession,
} from '../features/payments/ephemeralPaymentSession'
import { fetchProducts, type ProductSummary } from '../features/products/productsApi'

const progressItems = [
  { label: 'Producto', to: '/' },
  { label: 'Pago', to: '/checkout' },
  { label: 'Resumen', to: '/summary' },
  { label: 'Resultado', to: '/payment-result' },
]

export function PaymentSummaryPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const selectedProductId = useAppSelector((state) => state.checkout.selectedProductId)
  const delivery = useAppSelector((state) => state.checkout.delivery)
  const customerEmail = useAppSelector((state) => state.checkout.customerEmail)
  const payment = useAppSelector((state) => state.checkout.payment)
  const transaction = useAppSelector((state) => state.checkout.transaction)
  const [product, setProduct] = useState<ProductSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [acceptanceData, setAcceptanceData] = useState<AcceptanceData | null>(null)
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  const [hasAcceptedPersonalData, setHasAcceptedPersonalData] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const isDeliveryComplete = Object.values(delivery).every((value) => value.trim().length > 0)
  const hasPaymentMethod = payment.cardBrand !== null && payment.cardLastFour !== null
  const hasValidEmail = /^\S+@\S+\.\S+$/.test(customerEmail)
  const isCheckoutReady = Boolean(selectedProductId) && isDeliveryComplete && hasPaymentMethod && hasValidEmail
  const paymentSession = getEphemeralPaymentSession()

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

  useEffect(() => {
    if (!isCheckoutReady) return

    const controller = new AbortController()
    setAcceptanceError(null)
    setAcceptanceData(null)

    void getAcceptanceData(controller.signal)
      .then(setAcceptanceData)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setAcceptanceError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los contratos de pago.')
      })

    return () => controller.abort()
  }, [isCheckoutReady])

  async function confirmPayment(): Promise<void> {
    if (!product || !selectedProductId || !acceptanceData || !paymentSession || !payment.cardBrand || !payment.cardLastFour) return

    if (!hasAcceptedTerms || !hasAcceptedPersonalData) {
      setPaymentError('Debes aceptar ambos contratos para continuar.')
      return
    }

    setPaymentError(null)
    setIsProcessing(true)

    const idempotencyKey = transaction.idempotencyKey ?? crypto.randomUUID()

    try {
      const createdTransaction = await createTransaction({
        productId: selectedProductId,
        idempotencyKey,
        baseFeeInCents,
        shippingFeeInCents,
        customer: {
          fullName: delivery.recipientName,
          email: customerEmail.trim(),
          phone: delivery.phone,
        },
        delivery: {
          recipientName: delivery.recipientName,
          recipientPhone: delivery.phone,
          addressLine1: delivery.addressLine1,
          city: delivery.city,
          department: delivery.department,
          country: 'CO',
        },
      })

      dispatch(saveTransactionDraft({
        idempotencyKey,
        transactionId: createdTransaction.id,
        transactionReference: createdTransaction.reference,
      }))

      const result = await processPayment({
        transactionId: createdTransaction.id,
        cardToken: paymentSession.token,
        cardBrand: payment.cardBrand,
        cardLastFour: payment.cardLastFour,
        acceptanceToken: acceptanceData.acceptanceToken,
        acceptPersonalAuth: acceptanceData.personalDataAuthToken,
      })

      dispatch(saveTransactionDraft({
        idempotencyKey,
        transactionId: result.id,
        transactionReference: result.reference,
      }))
      clearEphemeralPaymentSession()
      navigate('/payment-result')
    } catch (submitError: unknown) {
      setPaymentError(submitError instanceof Error ? submitError.message : 'No pudimos procesar el pago.')
    } finally {
      setIsProcessing(false)
    }
  }

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

      {!isCheckoutReady ? (
        <section aria-live="polite" className="summary-feedback">
          <h2>Falta información para mostrar el resumen</h2>
          <p>Selecciona un producto y completa los datos de pago y entrega.</p>
          <Link className="button" to={selectedProductId ? '/checkout' : '/'}>
            {selectedProductId ? 'Completar pago y entrega' : 'Elegir un producto'}
          </Link>
        </section>
      ) : null}

      {isCheckoutReady ? (
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

          <section aria-labelledby="acceptance-title" className="summary-card">
            <p className="section-kicker">Confirmación</p>
            <h2 id="acceptance-title">Autoriza tu pago</h2>

            {!paymentSession ? (
              <div className="summary-next-step">
                <strong>Vuelve a añadir tu tarjeta para continuar.</strong>
                <p>Por seguridad, su token no se conserva al recargar la página.</p>
                <Link className="text-button" to="/checkout">Añadir tarjeta nuevamente</Link>
              </div>
            ) : null}

            {acceptanceError ? <p aria-live="polite" className="field-error">{acceptanceError}</p> : null}
            {acceptanceData && paymentSession ? (
              <div className="acceptance-options">
                <label className="acceptance-option">
                  <input checked={hasAcceptedTerms} type="checkbox" onChange={(event) => setHasAcceptedTerms(event.target.checked)} />
                  <span>
                    Acepto los <a href={acceptanceData.acceptancePermalink} rel="noreferrer" target="_blank">términos y condiciones</a> de pago.
                  </span>
                </label>
                <label className="acceptance-option">
                  <input checked={hasAcceptedPersonalData} type="checkbox" onChange={(event) => setHasAcceptedPersonalData(event.target.checked)} />
                  <span>
                    Autorizo el <a href={acceptanceData.personalDataAuthPermalink} rel="noreferrer" target="_blank">tratamiento de mis datos personales</a>.
                  </span>
                </label>
              </div>
            ) : null}

            {paymentError ? <p aria-live="polite" className="field-error">{paymentError}</p> : null}
            <button
              className="button summary-pay-button"
              disabled={!product || !acceptanceData || !paymentSession || !hasAcceptedTerms || !hasAcceptedPersonalData || isProcessing}
              type="button"
              onClick={() => void confirmPayment()}
            >
              {isProcessing ? 'Procesando pago…' : 'Confirmar y pagar'}
            </button>
          </section>
        </div>
      ) : null}

      <p className="screen-footer">Los valores se muestran en pesos colombianos e incluyen los cargos indicados.</p>
    </main>
  )
}
