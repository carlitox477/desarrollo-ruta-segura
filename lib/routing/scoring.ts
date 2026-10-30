import { CATEGORY_CONFIG } from '@/lib/alerts/config'
import { pointToSegmentMeters } from '@/lib/geo'
import type { Alert, AlertImpact, Priority, ScoredRoute } from '@/lib/types'

/**
 * Configurable, deterministic safety cost model.
 *
 * costo_ruta = costo_base + Σ penalizacion_alerta + penalizacion_datos_riesgo
 *
 * - costo_base: duration (seguridad/tiempo) or distance-equivalent seconds (distancia).
 * - penalizacion_alerta = PENALTY_SECONDS_FULL * severidad * antigüedad * confianza * proximidad
 *   Each alert is counted once per route, attributed to its closest segment.
 * - Total alert penalty is capped relative to the base cost to avoid absurd detours.
 */
export const SCORING_CONFIG = {
  influenceRadiusMeters: 120,
  penaltySecondsFull: 420,
  severityWeights: { 1: 0.15, 2: 0.35, 3: 0.6, 4: 0.85, 5: 1 } as Record<number, number>,
  confidence: {
    community: 0.7,
    demo: 0.9,
    perConfirmation: 0.08,
    maxConfirmationBonus: 0.24,
    perFlag: 0.15,
    min: 0.2,
    max: 1,
  },
  maxPenaltyRatio: 1.2,
  maxDetourRatio: 1.7,
  priorityAlertWeight: { seguridad: 1, tiempo: 0.15, distancia: 0.15 } as Record<Priority, number>,
  distanceModeMetersPerSecond: 1.3,
}

export type RawRoute = {
  geometry: [number, number][]
  distanceMeters: number
  durationSeconds: number
  source: 'osrm' | 'desvio'
}

function ageDecay(alert: Alert, now: number) {
  const expires = new Date(alert.expiresAt).getTime()
  if (now >= expires) return 0
  const occurred = new Date(alert.occurredAt).getTime()
  const ageHours = Math.max(0, (now - occurred) / 3_600_000)
  const halfLife = alert.isDemo ? 24 * 365 : CATEGORY_CONFIG[alert.category].halfLifeHours
  return Math.pow(0.5, ageHours / halfLife)
}

function confidence(alert: Alert) {
  const c = SCORING_CONFIG.confidence
  const base = alert.isDemo ? c.demo : c.community
  const bonus = Math.min(alert.confirmCount * c.perConfirmation, c.maxConfirmationBonus)
  return Math.min(c.max, Math.max(c.min, base + bonus - alert.flagCount * c.perFlag))
}

function proximity(distanceMeters: number) {
  const r = SCORING_CONFIG.influenceRadiusMeters
  if (distanceMeters >= r) return 0
  const x = 1 - distanceMeters / r
  return x * x * (3 - 2 * x)
}

export function computeImpacts(geometry: [number, number][], alerts: Alert[], now = Date.now()) {
  const impacts: AlertImpact[] = []
  for (const alert of alerts) {
    if (alert.status !== 'active') continue
    let best = Infinity
    let bestIdx = 0
    for (let i = 0; i < geometry.length - 1; i++) {
      const [aLng, aLat] = geometry[i]
      const [bLng, bLat] = geometry[i + 1]
      const d = pointToSegmentMeters(alert.lat, alert.lng, aLat, aLng, bLat, bLng)
      if (d < best) {
        best = d
        bestIdx = i
      }
    }
    const prox = proximity(best)
    if (prox === 0) continue
    const decay = ageDecay(alert, now)
    if (decay === 0) continue
    const weight =
      (SCORING_CONFIG.severityWeights[alert.severity] ?? 0.5) * decay * confidence(alert) * prox
    impacts.push({
      alertId: alert.id,
      category: alert.category,
      severity: alert.severity,
      distanceMeters: Math.round(best),
      ageHours: Math.round(((now - new Date(alert.occurredAt).getTime()) / 3_600_000) * 10) / 10,
      isDemo: alert.isDemo,
      weight: Math.round(weight * 1000) / 1000,
      penaltySeconds: Math.round(weight * SCORING_CONFIG.penaltySecondsFull),
      segmentIndex: bestIdx,
    })
  }
  return impacts.sort((a, b) => b.penaltySeconds - a.penaltySeconds)
}

function affectedSegments(geometry: [number, number][], impacts: AlertImpact[]) {
  return impacts.map((imp) => {
    const from = Math.max(0, imp.segmentIndex - 2)
    const to = Math.min(geometry.length, imp.segmentIndex + 4)
    return geometry.slice(from, to).map(([lng, lat]) => [lat, lng] as [number, number])
  })
}

function riskLevel(penaltySeconds: number, impactCount: number): ScoredRoute['riskLevel'] {
  if (impactCount === 0) return 'sin_datos'
  if (penaltySeconds < 90) return 'bajo'
  if (penaltySeconds < 300) return 'moderado'
  return 'elevado'
}

const fmtMin = (s: number) => `${Math.max(1, Math.round(s / 60))} min`
const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

export function scoreRoutes(raw: RawRoute[], alerts: Alert[], priority: Priority, now = Date.now()) {
  if (raw.length === 0) return []
  const fastest = Math.min(...raw.map((r) => r.durationSeconds))
  const reasonable = raw.filter((r) => r.durationSeconds <= fastest * SCORING_CONFIG.maxDetourRatio)
  const alertWeight = SCORING_CONFIG.priorityAlertWeight[priority]

  const scored = reasonable.map((r, i): ScoredRoute => {
    const impacts = computeImpacts(r.geometry, alerts, now)
    const base =
      priority === 'distancia'
        ? r.distanceMeters / SCORING_CONFIG.distanceModeMetersPerSecond
        : r.durationSeconds
    const rawPenalty = impacts.reduce((s, x) => s + x.penaltySeconds, 0)
    const alertPenalty = Math.round(Math.min(rawPenalty, base * SCORING_CONFIG.maxPenaltyRatio))
    // No official street-level risk data is available (see /api/openarg), so this term is 0.
    const riskDataPenalty = 0
    return {
      id: `r${i}`,
      label: '',
      geometry: r.geometry,
      distanceMeters: Math.round(r.distanceMeters),
      durationSeconds: Math.round(r.durationSeconds),
      alertPenaltySeconds: alertPenalty,
      riskDataPenaltySeconds: riskDataPenalty,
      cost: Math.round(base + alertPenalty * alertWeight + riskDataPenalty),
      impacts,
      affectedSegments: affectedSegments(r.geometry, impacts),
      riskLevel: riskLevel(alertPenalty, impacts.length),
      recommended: false,
      explanation: '',
    }
  })

  scored.sort((a, b) => a.cost - b.cost || a.durationSeconds - b.durationSeconds)
  const best = scored[0]
  best.recommended = true
  const fastestScored = [...scored].sort((a, b) => a.durationSeconds - b.durationSeconds)[0]

  scored.forEach((r, i) => {
    r.id = `r${i}`
    r.label = i === 0 ? 'Recomendada' : `Alternativa ${i}`
    r.explanation = explain(r, best, fastestScored, priority)
  })
  return scored
}

function explain(r: ScoredRoute, best: ScoredRoute, fastest: ScoredRoute, priority: Priority) {
  const n = r.impacts.length
  const alertsText =
    n === 0
      ? 'No pasa cerca de alertas activas (esto no garantiza que sea segura: puede faltar información).'
      : `Pasa a menos de ${SCORING_CONFIG.influenceRadiusMeters} m de ${n} alerta${n > 1 ? 's' : ''} (penalización +${fmtMin(r.alertPenaltySeconds)}).`

  if (r.recommended) {
    if (priority !== 'seguridad') {
      return `Menor ${priority === 'tiempo' ? 'tiempo' : 'distancia'} estimada. ${alertsText}`
    }
    if (r.id === fastest.id) {
      return `Es la más rápida y su costo de seguridad es el menor. ${alertsText}`
    }
    const extraT = r.durationSeconds - fastest.durationSeconds
    const extraD = r.distanceMeters - fastest.distanceMeters
    return `Elegida sobre la más rápida: suma ${fmtMin(extraT)} y ${fmtDist(Math.max(0, extraD))}, pero evita ${fastest.impacts.length - n > 0 ? `${fastest.impacts.length - n} alerta(s)` : 'alertas de mayor peso'} (penalización de la más rápida: +${fmtMin(fastest.alertPenaltySeconds)}). ${alertsText}`
  }
  const diff = r.cost - best.cost
  return `Costo total ${fmtMin(diff)} mayor que la recomendada. ${alertsText}`
}
