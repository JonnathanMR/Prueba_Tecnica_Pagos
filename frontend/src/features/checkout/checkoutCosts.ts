export const baseFeeInCents = 1_500
export const shippingFeeInCents = 5_000

export function formatCop(amountInCents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amountInCents / 100)
}
