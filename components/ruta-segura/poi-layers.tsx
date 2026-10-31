'use client'

import L from 'leaflet'
import { Cctv, Shield } from 'lucide-react'
import { useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import type { Poi } from '@/lib/types'
import { MAP_COLORS } from './client'

const CAMERA_MIN_ZOOM = 14

function iconFor(kind: Poi['kind']) {
  const isStation = kind === 'comisaria'
  const size = isStation ? 26 : 20
  const svg = renderToStaticMarkup(
    isStation ? (
      <Shield size={14} strokeWidth={2.5} color={MAP_COLORS.ink} />
    ) : (
      <Cctv size={11} strokeWidth={2.5} color={MAP_COLORS.fg} />
    ),
  )
  const bg = isStation ? MAP_COLORS.fg : MAP_COLORS.ink
  const ring = isStation ? MAP_COLORS.ink : MAP_COLORS.alt
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:${isStation ? '6px' : '9999px'};background:${bg};display:flex;align-items:center;justify-content:center;border:1.5px solid ${ring}">${svg}</div>`,
  })
}

function PoiPopup({ poi }: { poi: Poi }) {
  return (
    <Popup>
      <div className="flex min-w-48 flex-col gap-1 text-sm">
        <span className="font-semibold">{poi.name}</span>
        {poi.detail && <p className="leading-relaxed text-muted-foreground">{poi.detail}</p>}
        <p className="font-mono text-xs text-muted-foreground">
          Fuente: {poi.source === 'gcba' ? 'Datos abiertos GCBA' : 'OpenStreetMap'}
        </p>
      </div>
    </Popup>
  )
}

export function ComisariasLayer({ items }: { items: Poi[] }) {
  const icon = useMemo(() => iconFor('comisaria'), [])
  return items.map((p) => (
    <Marker key={p.id} position={[p.lat, p.lng]} icon={icon} title={p.name} zIndexOffset={-200}>
      <PoiPopup poi={p} />
    </Marker>
  ))
}

/** Cameras are dense (~1000), so only render the ones in view once zoomed in. */
export function CamarasLayer({ items }: { items: Poi[] }) {
  const map = useMap()
  const icon = useMemo(() => iconFor('camara'), [])
  const [view, setView] = useState(() => ({ zoom: map.getZoom(), bounds: map.getBounds().pad(0.2) }))
  useMapEvents({ moveend: () => setView({ zoom: map.getZoom(), bounds: map.getBounds().pad(0.2) }) })

  if (view.zoom < CAMERA_MIN_ZOOM) return null
  return items
    .filter((p) => view.bounds.contains([p.lat, p.lng]))
    .map((p) => (
      <Marker key={p.id} position={[p.lat, p.lng]} icon={icon} title={p.name} zIndexOffset={-400}>
        <PoiPopup poi={p} />
      </Marker>
    ))
}

export { CAMERA_MIN_ZOOM }
