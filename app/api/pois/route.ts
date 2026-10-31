import { NextResponse } from 'next/server'
import { getPois } from '@/lib/places'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getPois()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } })
  } catch (e) {
    console.error('[pois] failed', e)
    return NextResponse.json({ error: 'No se pudieron cargar comisarías y cámaras.' }, { status: 500 })
  }
}
