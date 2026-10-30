import type { Alert, LatLng, Priority, RoutesResponse, ScoredRoute, TravelMode } from '@/lib/types'

export type Place = LatLng & { label: string }
export type Trip = { origin: LatLng; destination: LatLng; priority: Priority; mode: TravelMode }
export type RoutesResult = RoutesResponse & { tripKey: string }

/** Mirrors the CSS tokens; Leaflet SVG attributes can't read CSS variables. */
export const MAP_COLORS = {
  primary: '#f2a93b',
  danger: '#e5484d',
  alt: '#9a9ea3',
  ink: '#111315',
  fg: '#ecebe6',
}

export const DEMO_TRIP = {
  origin: { lat: -34.6095, lng: -58.392, label: 'Plaza del Congreso' },
  destination: { lat: -34.5955, lng: -58.3935, label: 'Av. Callao y Av. Santa Fe' },
}

export class ApiError extends Error {}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Error ${res.status}`)
  return body as T
}

export const getAlerts = (url: string) => fetch(url).then((r) => json<{ alerts: Alert[] }>(r))

export async function postRoutes(tripKey: string): Promise<RoutesResult> {
  const res = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: tripKey,
  })
  return { ...(await json<RoutesResponse>(res)), tripKey }
}

export async function searchPlaces(q: string) {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
  return (await json<{ results: Place[] }>(res)).results
}

export async function postAlert(body: unknown) {
  const res = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json<{ alert: Alert; duplicateOf: number | null }>(res)
}

export async function flagAlert(id: number) {
  return json<{ alert: Alert }>(await fetch(`/api/alerts/${id}/flag`, { method: 'POST' }))
}

export function sameRoute(a: ScoredRoute, b: ScoredRoute) {
  return (
    Math.abs(a.distanceMeters - b.distanceMeters) / a.distanceMeters < 0.015 &&
    Math.abs(a.durationSeconds - b.durationSeconds) / a.durationSeconds < 0.015
  )
}

export const fmtMin = (s: number) => `${Math.max(1, Math.round(s / 60))} min`
export const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

export function fmtAge(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `hace ${Math.max(1, mins)} min`
  const h = Math.round(mins / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}
