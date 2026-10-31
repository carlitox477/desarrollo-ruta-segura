import type { LatLng, TransitStep, TransitVehicle } from '@/lib/types'
import type { RawRoute } from './scoring'

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.polyline.encodedPolyline',
  'routes.legs.steps.transitDetails',
].join(',')

/** Values pasted with surrounding quotes are common; Google rejects them as invalid. */
function apiKey() {
  const raw = process.env.GOOGLE_MAPS_API_KEY?.trim().replace(/^["']+|["']+$/g, '')
  if (!raw) throw new Error('Falta GOOGLE_MAPS_API_KEY')
  return raw
}

export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0
      let shift = 0
      let b: number
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lng += delta
    }
    out.push([lng / 1e5, lat / 1e5])
  }
  return out
}

type GStep = {
  travelMode: 'WALK' | 'TRANSIT'
  staticDuration?: string
  distanceMeters?: number
  polyline?: { encodedPolyline: string }
  transitDetails?: {
    headsign?: string
    stopCount?: number
    stopDetails?: {
      departureStop?: { name?: string }
      arrivalStop?: { name?: string }
      departureTime?: string
      arrivalTime?: string
    }
    transitLine?: {
      name?: string
      nameShort?: string
      color?: string
      textColor?: string
      vehicle?: { type?: string; name?: { text?: string } }
    }
  }
}
type GRoute = {
  duration?: string
  distanceMeters?: number
  polyline?: { encodedPolyline: string }
  legs?: { steps?: GStep[] }[]
}

const secs = (d?: string) => (d ? Number.parseInt(d, 10) || 0 : 0)

function vehicleOf(type?: string): TransitVehicle {
  if (type === 'SUBWAY' || type === 'METRO_RAIL') return 'subte'
  if (type === 'TRAM' || type === 'LIGHT_RAIL') return 'premetro'
  if (type && /RAIL|TRAIN/.test(type)) return 'tren'
  return 'colectivo'
}

function toSteps(steps: GStep[]): TransitStep[] {
  const out: TransitStep[] = []
  for (const s of steps) {
    const geometry = s.polyline ? decodePolyline(s.polyline.encodedPolyline) : []
    const durationSeconds = secs(s.staticDuration)
    const distanceMeters = s.distanceMeters ?? 0
    const prev = out[out.length - 1]
    if (s.travelMode !== 'TRANSIT' || !s.transitDetails) {
      if (prev?.kind === 'walk') {
        prev.durationSeconds += durationSeconds
        prev.distanceMeters += distanceMeters
        prev.geometry = prev.geometry.concat(geometry)
      } else {
        out.push({ kind: 'walk', durationSeconds, distanceMeters, geometry })
      }
      continue
    }
    const t = s.transitDetails
    const line = t.transitLine ?? {}
    out.push({
      kind: 'transit',
      durationSeconds,
      distanceMeters,
      geometry,
      vehicle: vehicleOf(line.vehicle?.type),
      lineShort: line.nameShort ?? line.name ?? '?',
      lineName: line.name ?? null,
      color: line.color ?? null,
      textColor: line.textColor ?? null,
      headsign: t.headsign ?? null,
      from: t.stopDetails?.departureStop?.name ?? null,
      to: t.stopDetails?.arrivalStop?.name ?? null,
      departureTime: t.stopDetails?.departureTime ?? null,
      arrivalTime: t.stopDetails?.arrivalTime ?? null,
      stopCount: t.stopCount ?? null,
    })
  }
  return out.filter((s) => s.kind === 'transit' || s.durationSeconds > 0)
}

export type RawTransitRoute = RawRoute & { steps: TransitStep[] }

export async function fetchTransitRoutes(origin: LatLng, destination: LatLng): Promise<RawTransitRoute[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: true,
      languageCode: 'es-419',
      regionCode: 'AR',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  const body = (await res.json().catch(() => ({}))) as { routes?: GRoute[]; error?: { message?: string } }
  if (!res.ok) throw new Error(body.error?.message ?? `Google ${res.status}`)

  const seen = new Set<string>()
  const out: RawTransitRoute[] = []
  for (const r of body.routes ?? []) {
    const steps = toSteps(r.legs?.flatMap((l) => l.steps ?? []) ?? [])
    const signature = steps
      .filter((s) => s.kind === 'transit')
      .map((s) => (s.kind === 'transit' ? `${s.lineShort}@${s.from}` : ''))
      .join('>')
    if (seen.has(signature)) continue
    seen.add(signature)
    const geometry = r.polyline ? decodePolyline(r.polyline.encodedPolyline) : steps.flatMap((s) => s.geometry)
    out.push({
      geometry,
      // Alerts matter where the traveler is exposed on the street: walking segments and stops.
      exposureGeometry: steps.filter((s) => s.kind === 'walk').flatMap((s) => s.geometry),
      distanceMeters: r.distanceMeters ?? 0,
      durationSeconds: secs(r.duration),
      source: 'google',
      steps,
    })
  }
  return out
}
