import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'

import '../App.css'
import { useAppDispatch } from '../app/hooks'
import {
  type CheckoutStep,
  moveToStep,
  resetCheckout,
} from '../features/checkout/checkoutSlice'

interface ScreenContent {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly note: string
  readonly primaryAction: { readonly label: string; readonly to: string }
  readonly secondaryAction?: { readonly label: string; readonly to: string }
}

const screens: Record<CheckoutStep, ScreenContent> = {
  product: {
    eyebrow: 'Paso 1 de 4',
    title: 'Selecciona tu producto',
    description:
      'La página de producto mostrará el catálogo, el precio y las unidades disponibles.',
    note: 'Base lista para conectar el catálogo y el stock desde la API.',
    primaryAction: { label: 'Ir al checkout', to: '/checkout' },
  },
  payment: {
    eyebrow: 'Paso 2 de 4',
    title: 'Pago y entrega',
    description:
      'Aquí vivirán la tarjeta de crédito y los datos de entrega validados.',
    note: 'Los datos sensibles de tarjeta no se persisten en localStorage.',
    primaryAction: { label: 'Ver resumen', to: '/summary' },
    secondaryAction: { label: 'Volver al producto', to: '/' },
  },
  summary: {
    eyebrow: 'Paso 3 de 4',
    title: 'Revisa el resumen',
    description:
      'El resumen mostrará el valor del producto, la tarifa base y el envío antes del pago.',
    note: 'Base lista para incorporar el backdrop y la confirmación de pago.',
    primaryAction: { label: 'Continuar', to: '/payment-result' },
    secondaryAction: { label: 'Editar datos', to: '/checkout' },
  },
  result: {
    eyebrow: 'Paso 4 de 4',
    title: 'Estado de la transacción',
    description:
      'Esta pantalla recibirá el resultado del pago y actualizará el stock mostrado.',
    note: 'Base lista para conectar la transacción y la respuesta de la API.',
    primaryAction: { label: 'Volver al producto', to: '/' },
  },
}

const progressItems: ReadonlyArray<{
  readonly step: CheckoutStep
  readonly label: string
  readonly to: string
}> = [
  { step: 'product', label: 'Producto', to: '/' },
  { step: 'payment', label: 'Pago', to: '/checkout' },
  { step: 'summary', label: 'Resumen', to: '/summary' },
  { step: 'result', label: 'Resultado', to: '/payment-result' },
]

interface CheckoutPageProps {
  readonly screen: CheckoutStep
}

export function CheckoutPage({ screen }: CheckoutPageProps) {
  const dispatch = useAppDispatch()
  const content = screens[screen]

  useEffect(() => {
    dispatch(moveToStep(screen))
  }, [dispatch, screen])

  function handlePrimaryAction(): void {
    if (screen === 'result') dispatch(resetCheckout())
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
            <li key={item.step}>
              <NavLink
                className={({ isActive }) =>
                  `progress-link${isActive ? ' progress-link--active' : ''}`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="screen-title" className="screen-card">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 id="screen-title">{content.title}</h1>
        <p>{content.description}</p>
        <aside className="scaffold-note">{content.note}</aside>
        <div className="screen-actions">
          <Link className="button" onClick={handlePrimaryAction} to={content.primaryAction.to}>
            {content.primaryAction.label}
          </Link>
          {content.secondaryAction ? (
            <Link className="button button--secondary" to={content.secondaryAction.to}>
              {content.secondaryAction.label}
            </Link>
          ) : null}
        </div>
      </section>

      <p className="screen-footer">Tu progreso no sensible se conserva localmente.</p>
    </main>
  )
}
