import { NextResponse } from 'next/server'
import { CABA_BOUNDS } from '@/lib/alerts/config'

type NominatimItem = { lat: string; lon: string; display_name: string; name?: string }

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 3 || q.length > 120) return NextResponse.json({ results: [] })
  const { west, north, east, south } = CABA_BOUNDS
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&bounded=1` +
    `&viewbox=${west},${north},${east},${south}&q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RutaSegura-hackathon/0.1', 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(String(res.status))
    const items = (await res.json()) as NominatimItem[]
    return NextResponse.json({
      results: items.map((i) => ({
        lat: Number(i.lat),
        lng: Number(i.lon),
        label: i.display_name.split(', ').slice(0, 3).join(', '),
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Búsqueda de direcciones no disponible.', results: [] }, { status: 502 })
  }
}
