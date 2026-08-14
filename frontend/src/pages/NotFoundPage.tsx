import { Link } from 'react-router-dom'

import '../App.css'

export function NotFoundPage() {
  return (
    <main className="checkout-shell">
      <section aria-labelledby="not-found-title" className="screen-card">
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">Esta pantalla no existe</h1>
        <p>Regresa al inicio para continuar con el checkout.</p>
        <div className="screen-actions">
          <Link className="button" to="/">
            Ir al producto
          </Link>
        </div>
      </section>
    </main>
  )
}
