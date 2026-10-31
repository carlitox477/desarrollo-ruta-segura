export const API_PLAN = {
  name: 'Ruta Segura API',
  description: 'Acceso por API a alertas activas y puntaje de riesgo de rutas en CABA, facturado por llamada.',
  currency: 'usd',
  /** Price per successful call, in cents. Stripe accepts up to 12 decimal places. */
  pricePerCallCents: '0.5',
  freeCallsPerMonth: 1000,
  meterEventName: 'ruta_segura_api_call',
  priceLookupKey: 'ruta-segura-api-por-llamada-v1',
  maxActiveKeys: 5,
  rateLimitPerMinute: 120,
} as const

export const PRICE_PER_CALL_USD = Number(API_PLAN.pricePerCallCents) / 100

export function formatUsd(amount: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  }).format(amount)
}

export function estimateMonthlyCost(calls: number) {
  return Math.max(0, calls - API_PLAN.freeCallsPerMonth) * PRICE_PER_CALL_USD
}
