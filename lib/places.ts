import 'server-only'
import type { Poi, PoisResponse } from '@/lib/types'
import { isInsideCaba } from '@/lib/alerts/config'

const SOURCES = {
  comisarias: {
    label: 'Comisarías de la Policía de la Ciudad (GCBA)',
    url: 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/comisarias-policia-de-la-ciudad/comisarias-policia-de-la-ciudad.csv',
  },
  camarasGcba: {
    label: 'Cámaras fijas de control vehicular (GCBA)',
    url: 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/camaras-fijas-control-vehicular/camaras-fijas-de-control-vehicular.csv',
  },
  camarasOsm: {
    label: 'Cámaras de vigilancia mapeadas en OpenStreetMap',
    url: 'https://overpass-api.de/api/interpreter',
  },
}

const TTL_MS = 12 * 3_600_000
let cache: { at: number; data: PoisResponse } | null = null

function parseCsv(text: string, sep: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  const [header, ...body] = rows
  const keys = header.map((h) => h.trim().toLowerCase())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

const num = (v: string | undefined) => Number((v ?? '').replace(',', '.'))
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s|\.)(\p{L})/gu, (m) => m.toUpperCase())

async function fetchText(url: string, init?: RequestInit, encoding = 'utf-8') {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return new TextDecoder(encoding).decode(await res.arrayBuffer())
}

async function loadComisarias(): Promise<Poi[]> {
  const rows = parseCsv(await fetchText(SOURCES.comisarias.url), ',')
  return rows
    .map((r) => ({
      id: `com-${r.id}`,
      kind: 'comisaria' as const,
      name: r.nombre || 'Comisaría',
      detail: [titleCase(r.direccion || ''), r.telefonos ? `Tel. ${r.telefonos}` : ''].filter(Boolean).join(' · ') || null,
      lat: num(r.lat),
      lng: num(r.long),
      source: 'gcba' as const,
    }))
    .filter((p) => isInsideCaba(p.lat, p.lng))
}

async function loadCamarasGcba(): Promise<Poi[]> {
  const text = await fetchText(SOURCES.camarasGcba.url, undefined, 'latin1')
  const rows = parseCsv(text, ';')
  return rows
    .map((r, i) => ({
      id: `gcba-cam-${i}`,
      kind: 'camara' as const,
      name: r.tipo_de_fiscalizador ? `Cámara: ${r.tipo_de_fiscalizador}` : 'Cámara de control vehicular',
      detail: r['ubicación'] ? titleCase(r['ubicación']) : null,
      lat: num(r.latitud),
      lng: num(r.longitud),
      source: 'gcba' as const,
    }))
    .filter((p) => isInsideCaba(p.lat, p.lng))
}

type OverpassNode = { id: number; lat: number; lon: number; tags?: Record<string, string> }

async function loadCamarasOsm(): Promise<Poi[]> {
  const query =
    '[out:json][timeout:25];node["man_made"="surveillance"]["surveillance"!="indoor"](-34.705,-58.531,-34.527,-58.335);out qt 3000;'
  const text = await fetchText(SOURCES.camarasOsm.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ruta-segura-caba/1.0' },
    body: new URLSearchParams({ data: query }),
  })
  const { elements } = JSON.parse(text) as { elements: OverpassNode[] }
  return elements
    .map((n) => {
      const t = n.tags ?? {}
      const type = t['surveillance:type'] === 'ALPR' ? 'Lectora de patentes' : 'Cámara de vigilancia'
      const operator = t.operator ? ` · ${t.operator}` : ''
      return {
        id: `osm-${n.id}`,
        kind: 'camara' as const,
        name: type,
        detail: `${t.surveillance === 'public' ? 'Vía pública' : 'Ubicación aproximada'}${operator}`,
        lat: n.lat,
        lng: n.lon,
        source: 'osm' as const,
      }
    })
    .filter((p) => isInsideCaba(p.lat, p.lng))
}

/** De-duplicate cameras that appear in both sources within ~25 m. */
function mergeCameras(a: Poi[], b: Poi[]) {
  const out = [...a]
  for (const p of b) {
    const near = out.some((q) => Math.abs(q.lat - p.lat) < 0.00022 && Math.abs(q.lng - p.lng) < 0.00027)
    if (!near) out.push(p)
  }
  return out
}

export async function getPois(): Promise<PoisResponse> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  const [com, gcba, osm] = await Promise.allSettled([loadComisarias(), loadCamarasGcba(), loadCamarasOsm()])
  for (const r of [com, gcba, osm]) if (r.status === 'rejected') console.error('[pois] source failed', r.reason)

  const comisarias = com.status === 'fulfilled' ? com.value : []
  const camGcba = gcba.status === 'fulfilled' ? gcba.value : []
  const camOsm = osm.status === 'fulfilled' ? osm.value : []
  const data: PoisResponse = {
    comisarias,
    camaras: mergeCameras(camGcba, camOsm),
    sources: [
      { id: 'comisarias', ...SOURCES.comisarias, count: comisarias.length, ok: com.status === 'fulfilled' },
      { id: 'camarasGcba', ...SOURCES.camarasGcba, count: camGcba.length, ok: gcba.status === 'fulfilled' },
      {
        id: 'camarasOsm',
        label: SOURCES.camarasOsm.label,
        url: 'https://www.openstreetmap.org/',
        count: camOsm.length,
        ok: osm.status === 'fulfilled',
      },
    ],
    fetchedAt: new Date().toISOString(),
  }
  // Don't pin a partial result for 12 h; retry sooner if any source failed.
  const allOk = data.sources.every((s) => s.ok)
  cache = { at: allOk ? Date.now() : Date.now() - TTL_MS + 10 * 60_000, data }
  return data
}
