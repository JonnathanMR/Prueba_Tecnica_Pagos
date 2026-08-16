import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import '../App.css'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  type DeliveryDraft,
  moveToStep,
  saveCustomerEmail,
  saveDeliveryDraft,
  savePaymentDraft,
} from '../features/checkout/checkoutSlice'
import { tokenizeCard, type TokenizedCard } from '../features/checkout/checkoutApi'
import {
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidExpiry,
  isValidLuhn,
  type CardBrand,
} from '../features/payments/cardValidation'
import { saveEphemeralPaymentSession } from '../features/payments/ephemeralPaymentSession'

interface CardSummary {
  readonly brand: Exclude<CardBrand, 'UNKNOWN'>
  readonly lastFour: string
}

const progressItems = [
  { label: 'Producto', to: '/' },
  { label: 'Pago', to: '/checkout' },
  { label: 'Resumen', to: '/summary' },
  { label: 'Resultado', to: '/payment-result' },
]

export function PaymentAndDeliveryPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const savedDelivery = useAppSelector((state) => state.checkout.delivery)
  const savedCustomerEmail = useAppSelector((state) => state.checkout.customerEmail)
  const savedPayment = useAppSelector((state) => state.checkout.payment)
  const [delivery, setDelivery] = useState<DeliveryDraft>(savedDelivery)
  const [customerEmail, setCustomerEmail] = useState(savedCustomerEmail)
  const [card, setCard] = useState<CardSummary | null>(
    savedPayment.cardBrand && savedPayment.cardLastFour
      ? { brand: savedPayment.cardBrand, lastFour: savedPayment.cardLastFour }
      : null,
  )
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false)
  const [showDeliveryErrors, setShowDeliveryErrors] = useState(false)

  useEffect(() => {
    dispatch(moveToStep('payment'))
  }, [dispatch])

  const isDeliveryComplete = Object.values(delivery).every((value) => value.trim().length > 0) && /^\d{10}$/.test(delivery.phone)
  const hasValidEmail = /^\S+@\S+\.\S+$/.test(customerEmail)

  function updateDelivery(field: keyof DeliveryDraft, value: string): void {
    const nextDelivery = {
      ...delivery,
      [field]: field === 'phone' ? digitsOnly(value).slice(0, 10) : value,
    }
    setDelivery(nextDelivery)
    dispatch(saveDeliveryDraft(nextDelivery))
  }

  function updateCustomerEmail(value: string): void {
    setCustomerEmail(value)
    dispatch(saveCustomerEmail(value))
  }

  function continueToSummary(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setShowDeliveryErrors(true)
    if (!isDeliveryComplete || !hasValidEmail || !card) return

    dispatch(saveDeliveryDraft(delivery))
    navigate('/summary')
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

      <p className="eyebrow">Paso 2 de 4</p>
      <h1 className="checkout-form-title">Pago y entrega</h1>
      <p className="checkout-form-intro">Añade una tarjeta y los datos para recibir tu compra.</p>

      <form className="checkout-form" noValidate onSubmit={continueToSummary}>
        <section aria-labelledby="payment-method-title" className="checkout-form-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Método de pago</p>
              <h2 id="payment-method-title">Tarjeta de crédito o débito</h2>
            </div>
            <span className="security-label">Datos protegidos</span>
          </div>

          {card ? (
            <div className="saved-card" aria-live="polite">
              <span className={`card-brand card-brand--${card.brand.toLowerCase()}`}>{card.brand}</span>
              <span>•••• {card.lastFour}</span>
              <button className="text-button" type="button" onClick={() => setIsCardDialogOpen(true)}>
                Cambiar
              </button>
            </div>
          ) : (
            <button className="add-card-button" type="button" onClick={() => setIsCardDialogOpen(true)}>
              <span aria-hidden="true" className="add-card-button__icon">+</span>
              Añadir tarjeta
            </button>
          )}
          {!card && showDeliveryErrors ? <p className="field-error">Añade una tarjeta válida para continuar.</p> : null}
        </section>

        <section aria-labelledby="delivery-title" className="checkout-form-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Entrega</p>
              <h2 id="delivery-title">¿Dónde recibes tu compra?</h2>
            </div>
          </div>

          <div className="form-grid">
            <Field label="Nombre de quien recibe" value={delivery.recipientName} onChange={(value) => updateDelivery('recipientName', value)} error={showDeliveryErrors && !delivery.recipientName.trim()} autoComplete="name" />
            <Field label="Celular" value={delivery.phone} onChange={(value) => updateDelivery('phone', value)} error={showDeliveryErrors && !/^\d{10}$/.test(delivery.phone)} inputMode="numeric" autoComplete="tel" hint="10 dígitos" />
            <Field label="Correo electrónico" value={customerEmail} onChange={updateCustomerEmail} error={showDeliveryErrors && !hasValidEmail} autoComplete="email" type="email" fullWidth />
            <Field label="Dirección" value={delivery.addressLine1} onChange={(value) => updateDelivery('addressLine1', value)} error={showDeliveryErrors && !delivery.addressLine1.trim()} autoComplete="street-address" fullWidth />
            <Field label="Ciudad" value={delivery.city} onChange={(value) => updateDelivery('city', value)} error={showDeliveryErrors && !delivery.city.trim()} autoComplete="address-level2" />
            <Field label="Departamento" value={delivery.department} onChange={(value) => updateDelivery('department', value)} error={showDeliveryErrors && !delivery.department.trim()} autoComplete="address-level1" />
          </div>
        </section>

        <div className="checkout-form-actions">
          <Link className="button button--secondary" to="/">Volver al producto</Link>
          <button className="button" type="submit">Ver resumen</button>
        </div>
      </form>

      <p className="screen-footer">Los datos completos de tu tarjeta no se guardan en este dispositivo.</p>

      {isCardDialogOpen ? (
        <CardDialog
          onClose={() => setIsCardDialogOpen(false)}
          onSave={(tokenizedCard) => {
            saveEphemeralPaymentSession(tokenizedCard)
            setCard({ brand: tokenizedCard.brand, lastFour: tokenizedCard.lastFour })
            dispatch(savePaymentDraft({ cardBrand: tokenizedCard.brand, cardLastFour: tokenizedCard.lastFour }))
            setIsCardDialogOpen(false)
          }}
        />
      ) : null}
    </main>
  )
}

interface FieldProps {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error: boolean
  readonly autoComplete: string
  readonly inputMode?: 'numeric'
  readonly hint?: string
  readonly fullWidth?: boolean
  readonly type?: 'email'
}

function Field({ label, value, onChange, error, autoComplete, inputMode, hint, fullWidth, type }: FieldProps) {
  const errorId = `${label.toLowerCase().replaceAll(' ', '-')}-error`
  return (
    <label className={`form-field${fullWidth ? ' form-field--full' : ''}`}>
      <span>{label}</span>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error}
        autoComplete={autoComplete}
        inputMode={inputMode}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && !error ? <small>{hint}</small> : null}
      {error ? <small id={errorId} className="field-error">Completa este campo correctamente.</small> : null}
    </label>
  )
}

interface CardDialogProps {
  readonly onClose: () => void
  readonly onSave: (card: TokenizedCard) => void
}

function CardDialog({ onClose, onSave }: CardDialogProps) {
  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isTokenizing, setIsTokenizing] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const brand = detectCardBrand(number)
  const validNumber = isValidLuhn(number) && brand !== 'UNKNOWN'
  const validExpiry = isValidExpiry(expiry)
  const validCvc = /^\d{3}$/.test(cvc)
  const validForm = validNumber && holder.trim().length >= 3 && validExpiry && validCvc

  useEffect(() => {
    closeButton.current?.focus()
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function saveCard(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSubmitted(true)
    if (!validForm) return
    setSubmitError(null)
    setIsTokenizing(true)

    try {
      const tokenizedCard = await tokenizeCard({
        number: digitsOnly(number),
        cvc,
        expMonth: expiry.slice(0, 2),
        expYear: expiry.slice(3),
        cardHolder: holder.trim(),
      })
      onSave(tokenizedCard)
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No pudimos validar la tarjeta.')
    } finally {
      setIsTokenizing(false)
    }
  }

  return (
    <div className="card-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="card-dialog-title" aria-modal="true" className="card-dialog" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="card-dialog__header">
          <div>
            <p className="section-kicker">Pago seguro</p>
            <h2 id="card-dialog-title">Añade tu tarjeta</h2>
          </div>
          <button ref={closeButton} aria-label="Cerrar formulario de tarjeta" className="image-modal__close" type="button" onClick={onClose}>×</button>
        </div>

        <form noValidate onSubmit={saveCard}>
          <label className="form-field">
            <span>Número de tarjeta</span>
            <div className="card-number-input">
              <input aria-invalid={submitted && !validNumber} autoComplete="cc-number" inputMode="numeric" placeholder="0000 0000 0000 0000" value={formatCardNumber(number)} onChange={(event) => setNumber(digitsOnly(event.target.value).slice(0, 19))} />
              {brand !== 'UNKNOWN' ? <strong className={`card-brand card-brand--${brand.toLowerCase()}`}>{brand}</strong> : null}
            </div>
            {submitted && !validNumber ? <small className="field-error">Ingresa una tarjeta Visa o Mastercard válida.</small> : <small>Validamos el número de forma local y segura.</small>}
          </label>

          <label className="form-field">
            <span>Nombre del titular</span>
            <input aria-invalid={submitted && holder.trim().length < 3} autoComplete="cc-name" value={holder} onChange={(event) => setHolder(event.target.value)} />
            {submitted && holder.trim().length < 3 ? <small className="field-error">Ingresa el nombre como aparece en la tarjeta.</small> : null}
          </label>

          <div className="form-grid">
            <label className="form-field">
              <span>Vencimiento</span>
              <input aria-invalid={submitted && !validExpiry} autoComplete="cc-exp" inputMode="numeric" placeholder="MM/AA" value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} />
              {submitted && !validExpiry ? <small className="field-error">Revisa la fecha.</small> : null}
            </label>
            <label className="form-field">
              <span>CVC</span>
              <input aria-invalid={submitted && !validCvc} autoComplete="cc-csc" inputMode="numeric" maxLength={3} placeholder="123" type="password" value={cvc} onChange={(event) => setCvc(digitsOnly(event.target.value).slice(0, 3))} />
              {submitted && !validCvc ? <small className="field-error">Ingresa los 3 dígitos.</small> : null}
            </label>
          </div>

          <button className="button card-dialog__submit" disabled={isTokenizing} type="submit">
            {isTokenizing ? 'Validando tarjeta…' : 'Guardar tarjeta'}
          </button>
          {submitError ? <p aria-live="polite" className="field-error">{submitError}</p> : null}
        </form>
      </section>
    </div>
  )
}
