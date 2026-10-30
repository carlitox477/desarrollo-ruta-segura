import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isInsideCaba } from '@/lib/alerts/config'
import { listAlerts } from '@/lib/alerts/service'
import { dedupeRoutes, fetchBaseRoutes, fetchDetours } from '@/lib/routing/osrm'
import { computeImpacts, scoreRoutes, type RawRoute } from '@/lib/routing/scoring'
import type { Alert, RoutesResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

const point = z.object({ lat: z.number().finite(), lng: z.number().finite() })
const schema = z.object({
  origin: point,
  destination: point,
  priority: z.enum(['seguridad', 'tiempo', 'distancia']).default('seguridad'),
  mode: z.enum(['foot', 'car']).default('foot'),
})

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Origen o destino inválidos.' }, { status: 400 })
  const { origin, destination, priority, mode } = parsed.data
  if (!isInsideCaba(origin.lat, origin.lng) || !isInsideCaba(destination.lat, destination.lng)) {
    return NextResponse.json({ error: 'Origen y destino deben estar dentro de CABA.' }, { status: 400 })
  }

  const warnings: string[] = []
  let alerts: Alert[] = []
  try {
    alerts = await listAlerts()
  } catch (e) {
    console.error('[routes] alerts unavailable', e)
    warnings.push('No se pudieron leer las alertas: las rutas se calcularon sin penalizaciones.')
  }

  let raw: RawRoute[]
  try {
    raw = await fetchBaseRoutes(origin, destination, mode)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: `El servicio de ruteo no está disponible (${msg}). Probá de nuevo.` }, { status: 502 })
  }

  // If the fastest candidates cross alerts, request detours around the heaviest ones.
  const heaviest = raw
    .flatMap((r) => computeImpacts(r.geometry, alerts))
    .sort((a, b) => b.penaltySeconds - a.penaltySeconds)
  const targets = [...new Map(heaviest.map((i) => [i.alertId, i])).values()].slice(0, 2)
  if (targets.length > 0) {
    const detours = await Promise.all(
      targets.map((t) => {
        const a = alerts.find((x) => x.id === t.alertId)!
        return fetchDetours(origin, destination, { lat: a.lat, lng: a.lng }, mode).catch(() => [])
      }),
    )
    raw = raw.concat(detours.flat())
  }

  const routes = scoreRoutes(dedupeRoutes(raw), alerts, priority).slice(0, 4)
  const body: RoutesResponse = {
    routes,
    priority,
    mode,
    alertsConsidered: alerts.length,
    officialData: {
      available: false,
      note: 'Sin datos oficiales a nivel de calle: la penalización por datos de riesgo es 0.',
    },
    computedAt: new Date().toISOString(),
    warnings,
  }
  return NextResponse.json(body)
}
