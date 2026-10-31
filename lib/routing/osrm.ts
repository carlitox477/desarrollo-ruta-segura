import { haversineMeters, offsetPoint } from '@/lib/geo'
import type { LatLng, TravelMode } from '@/lib/types'
import type { RawRoute } from './scoring'

const ENDPOINTS: Record<Exclude<TravelMode, 'transit'>, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  car: 'https://router.project-osrm.org/route/v1/driving',
}

type OsrmResponse = {
  code: string
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[]
}

async function request(points: LatLng[], mode: TravelMode, alternatives: boolean) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${ENDPOINTS[mode === 'transit' ? 'foot' : mode]}/${coords}?overview=full&geometries=geojson&alternatives=${alternatives ? 3 : 'false'}`
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'RutaSegura-hackathon/0.1' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Servicio de ruteo respondió ${res.status}`)
  const json = (await res.json()) as OsrmResponse
  if (json.code !== 'Ok' || !json.routes) throw new Error(`Ruteo sin resultado (${json.code})`)
  return json.routes.map(
    (r): RawRoute => ({
      geometry: r.geometry.coordinates,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      source: points.length > 2 ? 'desvio' : 'osrm',
    }),
  )
}

export async function fetchBaseRoutes(origin: LatLng, destination: LatLng, mode: TravelMode) {
  return request([origin, destination], mode, true)
}

/**
 * Builds detour candidates around an alert: two via-points offset perpendicular
 * to the origin→destination axis, on each side of the alert.
 */
export async function fetchDetours(
  origin: LatLng,
  destination: LatLng,
  around: LatLng,
  mode: TravelMode,
) {
  const dx = destination.lng - origin.lng
  const dy = destination.lat - origin.lat
  const len = Math.hypot(dx, dy) || 1
  const perpNorth = dx / len
  const perpEast = -dy / len
  const tripM = haversineMeters(origin.lat, origin.lng, destination.lat, destination.lng)
  const offset = Math.min(600, Math.max(250, tripM * 0.12))
  const vias = [1, -1].map((s) => offsetPoint(around.lat, around.lng, perpNorth * offset * s, perpEast * offset * s))
  const results = await Promise.allSettled(vias.map((v) => request([origin, v, destination], mode, false)))
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/** Removes near-duplicate routes (same distance within 1.5% and similar duration). */
export function dedupeRoutes(routes: RawRoute[]) {
  const out: RawRoute[] = []
  for (const r of routes) {
    const dup = out.some(
      (o) =>
        Math.abs(o.distanceMeters - r.distanceMeters) / o.distanceMeters < 0.015 &&
        Math.abs(o.durationSeconds - r.durationSeconds) / o.durationSeconds < 0.015,
    )
    if (!dup) out.push(r)
  }
  return out
}
