import 'server-only'

const BASE = 'https://api.openarg.org/api/v1/catalogo'

export type OpenArgDataset = {
  title: string
  portal: string | null
  url: string | null
  description: string | null
  tables: { name: string; rows: number | null }[]
}

export type OpenArgStatus =
  | { configured: false; note: string }
  | {
      configured: true
      ok: boolean
      queriedAt: string
      queries: string[]
      datasets: OpenArgDataset[]
      error?: string
      note: string
    }

const SEARCHES = ['delitos ciudad de buenos aires', 'robos CABA', 'luminarias alumbrado público CABA']

const LIMITATION_NOTE =
  'Los datasets oficiales de criminalidad disponibles se publican agregados por jurisdicción, comuna o barrio y por período; no permiten evaluar el riesgo calle por calle en tiempo real. Por eso no se usan para penalizar segmentos: el ruteo se basa en alertas comunitarias.'

type CacheEntry = { at: number; value: OpenArgStatus }
const globalCache = globalThis as unknown as { openArgCache?: CacheEntry }
const TTL_MS = 6 * 60 * 60 * 1000

function pick(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v) return v
  }
  return null
}

function normalize(json: unknown): OpenArgDataset[] {
  const root = json as Record<string, unknown>
  const list = (Array.isArray(json)
    ? json
    : (root?.resultados ?? root?.results ?? root?.datasets ?? root?.items ?? [])) as Record<string, unknown>[]
  if (!Array.isArray(list)) return []
  return list.slice(0, 6).map((d) => {
    const rawTables = (d.tablas ?? d.tables ?? []) as Record<string, unknown>[]
    return {
      title: pick(d, ['titulo', 'title', 'nombre', 'name']) ?? 'Dataset sin título',
      portal: pick(d, ['portal', 'fuente', 'source']),
      url: pick(d, ['link', 'url', 'link_fuente', 'source_url']),
      description: pick(d, ['descripcion', 'description']),
      tables: Array.isArray(rawTables)
        ? rawTables.slice(0, 3).map((t) => ({
            name: (pick(t, ['nombre', 'name', 'tabla']) ?? '') as string,
            rows: typeof t.filas === 'number' ? t.filas : typeof t.rows === 'number' ? t.rows : null,
          }))
        : [],
    }
  })
}

/**
 * Searches the OpenArg catalog (data mode, does not consume LLM questions).
 * Results are cached for 6h so route computation never depends on OpenArg.
 */
export async function getOpenArgStatus(): Promise<OpenArgStatus> {
  const key = process.env.OPENARG_API_KEY
  if (!key) {
    return {
      configured: false,
      note: `Falta la variable OPENARG_API_KEY (clave gratuita en mcp.openarg.org). ${LIMITATION_NOTE}`,
    }
  }
  const cached = globalCache.openArgCache
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value

  const queriedAt = new Date().toISOString()
  try {
    const results = await Promise.all(
      SEARCHES.map(async (q) => {
        const res = await fetch(`${BASE}/buscar?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`OpenArg respondió ${res.status} (${res.headers.get('x-openarg-error') ?? 'error'})`)
        return normalize(await res.json())
      }),
    )
    const seen = new Set<string>()
    const datasets = results.flat().filter((d) => {
      const k = d.title + d.portal
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    const value: OpenArgStatus = { configured: true, ok: true, queriedAt, queries: SEARCHES, datasets, note: LIMITATION_NOTE }
    globalCache.openArgCache = { at: Date.now(), value }
    return value
  } catch (e) {
    return {
      configured: true,
      ok: false,
      queriedAt,
      queries: SEARCHES,
      datasets: [],
      error: e instanceof Error ? e.message : 'Error desconocido',
      note: LIMITATION_NOTE,
    }
  }
}
