export const FLEET_PLAN = {
  id: 'flota-mensual',
  name: 'Ruta Segura Flotas',
  description: 'Ruteo con alertas comunitarias para unidades de transporte, facturado por unidad.',
  pricePerVehicleCents: 500,
  currency: 'usd',
  minVehicles: 1,
  maxVehicles: 500,
} as const

export function isValidVehicleCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= FLEET_PLAN.minVehicles &&
    value <= FLEET_PLAN.maxVehicles
  )
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
