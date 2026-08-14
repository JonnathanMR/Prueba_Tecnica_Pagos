import { configureStore } from '@reduxjs/toolkit'

import checkoutReducer, {
  loadCheckoutState,
  persistCheckoutState,
} from '../features/checkout/checkoutSlice'

export const store = configureStore({
  reducer: { checkout: checkoutReducer },
  preloadedState: { checkout: loadCheckoutState() },
})

store.subscribe(() => {
  persistCheckoutState(store.getState().checkout)
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
