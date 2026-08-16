import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import '../App.css'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  getTransaction,
  type TransactionResponse,
  type TransactionStatus,
} from '../features/checkout/checkoutApi'
import { moveToStep, resetCheckout } from '../features/checkout/checkoutSlice'
import { formatCop } from '../features/checkout/checkoutCosts'

const pollIntervalInMilliseconds = 3_000

const progressItems = [
  { label: 'Producto', to: '/' },
  { label: 'Pago', to: '/checkout' },
  { label: 'Resumen', to: '/summary' },
  { label: 'Resultado', to: '/payment-result' },
]

const statusContent: Record<TransactionStatus, { readonly title: string; readonly description: string; readonly tone: string }> = {
  APPROVED: {
    title: 'Pago aprobado',
    description: 'Tu compra fue confirmada. El inventario ya fue actualizado y tu pedido está listo para preparación.',
    tone: 'success',
  },
  PENDING: {
    title: 'Estamos confirmando tu pago',
    description: 'La pasarela aún está procesando la transacción. Actualizaremos esta pantalla automáticamente.',
    tone: 'pending',
  },
  DECLINED: {
    title: 'Pago rechazado',
    description: 'No se realizó ningún cobro ni se modificó el inventario. Puedes intentar con otra tarjeta.',
    tone: 'error',
  },
  ERROR: {
    title: 'No pudimos procesar el pago',
    description: 'No se realizó ningún cobro ni se modificó el inventario. Inténtalo de nuevo más tarde.',
    tone: 'error',
  },
  VOIDED: {
    title: 'Pago anulado',
    description: 'La transacción fue anulada. No se realizó ningún cobro ni se modificó el inventario.',
    tone: 'error',
  },
}

export function PaymentResultPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const transactionId = useAppSelector((state) => state.checkout.transaction.transactionId)
  const storedReference = useAppSelector((state) => state.checkout.transaction.transactionReference)
  const [transaction, setTransaction] = useState<TransactionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(transactionId))
  const pollTimer = useRef<number | null>(null)

  useEffect(() => {
    dispatch(moveToStep('result'))
  }, [dispatch])

  useEffect(() => {
    if (!transactionId) return

    const activeTransactionId = transactionId
    const controller = new AbortController()
    let isCancelled = false

    async function loadTransaction(): Promise<void> {
      try {
        const response = await getTransaction(activeTransactionId, controller.signal)
        if (isCancelled) return

        setTransaction(response)
        setError(null)
        if (response.status === 'PENDING') {
          pollTimer.current = window.setTimeout(() => void loadTransaction(), pollIntervalInMilliseconds)
        }
      } catch (loadError: unknown) {
        if (isCancelled || (loadError instanceof DOMException && loadError.name === 'AbortError')) return
        setError(loadError instanceof Error ? loadError.message : 'No pudimos consultar el estado de la transacción.')
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void loadTransaction()

    return () => {
      isCancelled = true
      controller.abort()
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current)
    }
  }, [transactionId])

  function returnToCatalog(): void {
    dispatch(resetCheckout())
    navigate('/')
  }

  const content = transaction ? statusContent[transaction.status] : null

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

      <p className="eyebrow">Paso 4 de 4</p>

      {!transactionId ? (
        <section aria-live="polite" className="result-card result-card--empty">
          <h1>No hay una transacción para consultar</h1>
          <p>Selecciona un producto para iniciar una nueva compra.</p>
          <Link className="button" to="/">Ir al catálogo</Link>
        </section>
      ) : null}

      {transactionId && isLoading ? (
        <section aria-live="polite" className="result-card result-card--loading">
          <span aria-hidden="true" className="result-spinner" />
          <h1>Consultando el estado del pago…</h1>
          <p>Estamos verificando la información con el servidor.</p>
        </section>
      ) : null}

      {transactionId && error ? (
        <section aria-live="polite" className="result-card result-card--empty">
          <h1>No pudimos consultar el pago</h1>
          <p>{error}</p>
          <button className="button" type="button" onClick={() => window.location.reload()}>Reintentar</button>
        </section>
      ) : null}

      {transaction && content ? (
        <section aria-labelledby="payment-result-title" className={`result-card result-card--${content.tone}`}>
          <div aria-hidden="true" className="result-status-icon">
            {transaction.status === 'APPROVED' ? '✓' : transaction.status === 'PENDING' ? '…' : '×'}
          </div>
          <h1 id="payment-result-title">{content.title}</h1>
          <p className="result-description">{content.description}</p>

          <dl className="result-facts">
            <div>
              <dt>Referencia</dt>
              <dd>{transaction.reference || storedReference}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCop(transaction.amounts.totalInCents)}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>{transaction.delivery.city}, {transaction.delivery.department}</dd>
            </div>
            {transaction.paymentMethod ? (
              <div>
                <dt>Tarjeta</dt>
                <dd>{transaction.paymentMethod.cardBrand} •••• {transaction.paymentMethod.cardLastFour}</dd>
              </div>
            ) : null}
          </dl>

          {transaction.status === 'PENDING' ? <p className="result-refreshing">Actualizando automáticamente cada 3 segundos.</p> : null}

          <div className="result-actions">
            {transaction.status === 'APPROVED' ? (
              <button className="button" type="button" onClick={returnToCatalog}>Volver al catálogo</button>
            ) : null}
            {transaction.status !== 'APPROVED' && transaction.status !== 'PENDING' ? (
              <Link className="button" to="/checkout">Cambiar tarjeta e intentar de nuevo</Link>
            ) : null}
            {transaction.status === 'PENDING' ? (
              <button className="button button--secondary" type="button" onClick={returnToCatalog}>Volver al catálogo</button>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  )
}
