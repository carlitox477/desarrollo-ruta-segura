import { NextResponse } from 'next/server'
import { AlertError, flagAlert } from '@/lib/alerts/service'
import { getReporterHash } from '@/lib/reporter'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const alertId = Number(id)
  if (!Number.isInteger(alertId) || alertId <= 0) {
    return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
  }
  try {
    const alert = await flagAlert(alertId, await getReporterHash())
    return NextResponse.json({ alert })
  } catch (e) {
    if (e instanceof AlertError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[alerts] flag failed', e)
    return NextResponse.json({ error: 'No se pudo registrar la marca.' }, { status: 500 })
  }
}
