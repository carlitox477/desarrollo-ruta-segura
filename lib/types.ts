export type LatLng = { lat: number; lng: number }

export type AlertCategory =
  | 'robo'
  | 'intento_robo'
  | 'acoso'
  | 'iluminacion'
  | 'sospechosa'
  | 'otro'

export type AlertStatus = 'active' | 'expired' | 'dismissed'

export type Alert = {
  id: number
  category: AlertCategory
  severity: number
  description: string | null
  lat: number
  lng: number
  occurredAt: string
  createdAt: string
  expiresAt: string
  status: AlertStatus
  isDemo: boolean
  flagCount: number
  confirmCount: number
}

export type Priority = 'seguridad' | 'tiempo' | 'distancia'
export type TravelMode = 'foot' | 'car'

export type AlertImpact = {
  alertId: number
  category: AlertCategory
  severity: number
  distanceMeters: number
  ageHours: number
  isDemo: boolean
  weight: number
  penaltySeconds: number
  segmentIndex: number
}

export type ScoredRoute = {
  id: string
  label: string
  geometry: [number, number][]
  distanceMeters: number
  durationSeconds: number
  alertPenaltySeconds: number
  riskDataPenaltySeconds: number
  cost: number
  impacts: AlertImpact[]
  affectedSegments: [number, number][][]
  riskLevel: 'sin_datos' | 'bajo' | 'moderado' | 'elevado'
  recommended: boolean
  explanation: string
}

export type RoutesResponse = {
  routes: ScoredRoute[]
  priority: Priority
  mode: TravelMode
  alertsConsidered: number
  officialData: { available: boolean; note: string }
  computedAt: string
  warnings: string[]
}
