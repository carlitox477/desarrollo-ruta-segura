import type { AlertCategory } from '@/lib/types'

type CategoryConfig = {
  label: string
  ttlHours: number
  halfLifeHours: number
  defaultSeverity: number
}

export const CATEGORY_CONFIG: Record<AlertCategory, CategoryConfig> = {
  robo: { label: 'Robo', ttlHours: 72, halfLifeHours: 24, defaultSeverity: 4 },
  intento_robo: { label: 'Intento de robo', ttlHours: 48, halfLifeHours: 18, defaultSeverity: 3 },
  acoso: { label: 'Acoso', ttlHours: 48, halfLifeHours: 18, defaultSeverity: 3 },
  iluminacion: { label: 'Iluminación deficiente', ttlHours: 24 * 14, halfLifeHours: 24 * 5, defaultSeverity: 2 },
  sospechosa: { label: 'Situación sospechosa', ttlHours: 12, halfLifeHours: 4, defaultSeverity: 2 },
  otro: { label: 'Otro', ttlHours: 24, halfLifeHours: 8, defaultSeverity: 2 },
}

export const CATEGORIES = Object.keys(CATEGORY_CONFIG) as AlertCategory[]

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Muy baja',
  2: 'Baja',
  3: 'Media',
  4: 'Alta',
  5: 'Muy alta',
}

export const ABUSE_LIMITS = {
  maxReportsPerWindow: 4,
  windowMinutes: 10,
  duplicateRadiusMeters: 80,
  duplicateWindowMinutes: 60,
  flagsToDismiss: 3,
  descriptionMaxLength: 280,
}

export const CABA_BOUNDS = {
  south: -34.705,
  north: -34.526,
  west: -58.531,
  east: -58.335,
}

export function isInsideCaba(lat: number, lng: number) {
  return (
    lat >= CABA_BOUNDS.south &&
    lat <= CABA_BOUNDS.north &&
    lng >= CABA_BOUNDS.west &&
    lng <= CABA_BOUNDS.east
  )
}
