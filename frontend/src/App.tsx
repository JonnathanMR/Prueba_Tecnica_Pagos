import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { NotFoundPage } from './pages/NotFoundPage'
import { PaymentAndDeliveryPage } from './pages/PaymentAndDeliveryPage'
import { PaymentResultPage } from './pages/PaymentResultPage'
import { PaymentSummaryPage } from './pages/PaymentSummaryPage'
import { ProductPage } from './pages/ProductPage'

const router = createBrowserRouter([
  { path: '/', element: <ProductPage /> },
  { path: '/checkout', element: <PaymentAndDeliveryPage /> },
  { path: '/summary', element: <PaymentSummaryPage /> },
  { path: '/payment-result', element: <PaymentResultPage /> },
  { path: '*', element: <NotFoundPage /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
