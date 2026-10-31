import { NextResponse } from 'next/server'
import { AlertError, createAlert, createAlertSchema, listAlerts } from '@/lib/alerts/service'
import { getReporterHash } from '@/lib/reporter'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const includeInactive = new URL(req.url).searchParams.get('all') === '1'
  try {
    const alerts = await listAlerts({ includeInactive, reporterHash: await getReporterHash() })
    return NextResponse.json({ alerts })
  } catch (e) {
    console.error('[alerts] list failed', e)
    return NextResponse.json({ error: 'No se pudieron cargar las alertas.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = createAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    )
  }
  try {
    const reporterHash = await getReporterHash()
    const result = await createAlert(parsed.data, reporterHash)
    return NextResponse.json(result, { status: result.duplicateOf ? 200 : 201 })
  } catch (e) {
    if (e instanceof AlertError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[alerts] create failed', e)
    return NextResponse.json({ error: 'No se pudo guardar la alerta.' }, { status: 500 })
  }
}
