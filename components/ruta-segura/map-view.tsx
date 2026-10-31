'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { CATEGORY_CONFIG, SEVERITY_LABELS } from '@/lib/alerts/config'
import type { Alert, LatLng, Poi, ScoredRoute } from '@/lib/types'
import { AlertActions } from './alert-actions'
import { fmtAge, MAP_COLORS, type Place } from './client'
import { CamarasLayer, ComisariasLayer } from './poi-layers'

type Props = {
  comisarias: Poi[]
  camaras: Poi[]
  showComisarias: boolean
  showCamaras: boolean
  onWithdraw: (id: number) => Promise<void>
  alerts: Alert[]
  routes: ScoredRoute[]
  selectedId: string | null
  origin: Place | null
  destination: Place | null
  draft: LatLng | null
  onMapClick: (p: LatLng) => void
  onSelectRoute: (id: string) => void
  onFlag: (id: number) => Promise<void>
}

function pinIcon(letter: string, bg: string, fg: string) {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font:600 13px var(--font-sans);border:2px solid ${MAP_COLORS.ink};box-shadow:0 0 0 2px ${bg}">${letter}</div>`,
  })
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function FitToRoutes({ routes, origin, destination }: Pick<Props, 'routes' | 'origin' | 'destination'>) {
  const map = useMap()
  const sig = routes.map((r) => r.id + r.distanceMeters).join()
  useEffect(() => {
    const pts: [number, number][] = routes.flatMap((r) => r.geometry.map(([lng, lat]) => [lat, lng] as [number, number]))
    if (origin) pts.push([origin.lat, origin.lng])
    if (destination) pts.push([destination.lat, destination.lng])
    if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, origin?.lat, origin?.lng, destination?.lat, destination?.lng])
  return null
}

export default function MapView(props: Props) {
  const { alerts, routes, selectedId, origin, destination, draft } = props
  const icons = useMemo(
    () => ({
      a: pinIcon('A', MAP_COLORS.fg, MAP_COLORS.ink),
      b: pinIcon('B', MAP_COLORS.primary, MAP_COLORS.ink),
      draft: pinIcon('!', MAP_COLORS.danger, MAP_COLORS.fg),
    }),
    [],
  )
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0]
  const others = routes.filter((r) => r !== selected)

  return (
    <MapContainer
      center={[-34.6037, -58.3816]}
      zoom={13}
      minZoom={11}
      maxBounds={[
        [-34.78, -58.62],
        [-34.45, -58.25],
      ]}
      className="isolate z-0 size-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles-dark"
      />
      <ClickHandler onClick={props.onMapClick} />
      <FitToRoutes routes={routes} origin={origin} destination={destination} />
      {props.showCamaras && <CamarasLayer items={props.camaras} />}
      {props.showComisarias && <ComisariasLayer items={props.comisarias} />}

      {others.map((r) => (
        <Polyline
          key={r.id}
          positions={r.geometry.map(([lng, lat]) => [lat, lng])}
          pathOptions={{ color: MAP_COLORS.alt, weight: 5, opacity: 0.55, dashArray: '2 8' }}
          eventHandlers={{ click: () => props.onSelectRoute(r.id) }}
        />
      ))}
      {selected && (
        <>
          <Polyline
            positions={selected.geometry.map(([lng, lat]) => [lat, lng])}
            pathOptions={{ color: MAP_COLORS.ink, weight: 10, opacity: 0.9 }}
          />
          {selected.steps ? (
            selected.steps.map((s, i) => (
              <Polyline
                key={`step-${i}`}
                positions={s.geometry.map(([lng, lat]) => [lat, lng])}
                pathOptions={
                  s.kind === 'walk'
                    ? { color: MAP_COLORS.fg, weight: 4, dashArray: '1 9', lineCap: 'round' }
                    : { color: s.color ?? MAP_COLORS.primary, weight: 6 }
                }
              />
            ))
          ) : (
            <Polyline
              positions={selected.geometry.map(([lng, lat]) => [lat, lng])}
              pathOptions={{ color: MAP_COLORS.primary, weight: 6 }}
            />
          )}
          {selected.affectedSegments.map((seg, i) => (
            <Polyline key={i} positions={seg} pathOptions={{ color: MAP_COLORS.danger, weight: 7 }} />
          ))}
        </>
      )}

      {alerts.map((a) => {
        const color = a.severity >= 3 ? MAP_COLORS.danger : MAP_COLORS.primary
        return (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lng]}
            radius={6 + a.severity * 1.5}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2, dashArray: a.isDemo ? '3 3' : undefined }}
          >
            <Popup>
              <div className="flex min-w-52 flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{CATEGORY_CONFIG[a.category].label}</span>
                  {a.isDemo && (
                    <span className="rounded-sm bg-primary px-1.5 py-0.5 font-mono text-xs text-primary-foreground">DEMO</span>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  Severidad {a.severity}/5 ({SEVERITY_LABELS[a.severity]}) · {fmtAge(a.occurredAt)}
                </p>
                {a.description && <p className="leading-relaxed">{a.description}</p>}
                <p className="font-mono text-xs text-muted-foreground">
                  {a.confirmCount} confirmaciones · {a.flagCount} marcas · vence {new Date(a.expiresAt).toLocaleDateString('es-AR')}
                </p>
                <AlertActions alert={a} onFlag={props.onFlag} onWithdraw={props.onWithdraw} />
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {origin && <Marker position={[origin.lat, origin.lng]} icon={icons.a} />}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={icons.b} />}
      {draft && <Marker position={[draft.lat, draft.lng]} icon={icons.draft} />}
    </MapContainer>
  )
}
