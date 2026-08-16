import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { CheckoutPage } from './pages/CheckoutPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PaymentAndDeliveryPage } from './pages/PaymentAndDeliveryPage'
import { ProductPage } from './pages/ProductPage'

const router = createBrowserRouter([
  { path: '/', element: <ProductPage /> },
  { path: '/checkout', element: <PaymentAndDeliveryPage /> },
  { path: '/summary', element: <CheckoutPage screen="summary" /> },
  { path: '/payment-result', element: <CheckoutPage screen="result" /> },
  { path: '*', element: <NotFoundPage /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
