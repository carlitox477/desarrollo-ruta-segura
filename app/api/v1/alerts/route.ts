import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listAlerts } from '@/lib/alerts/service'
import { withApiKey } from '@/lib/business/api-keys'
import { haversineMeters } from '@/lib/geo'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(50).max(3000).default(500),
})

export function GET(req: Request) {
  return withApiKey(req, 'GET /api/v1/alerts', async () => {
    const params = Object.fromEntries(new URL(req.url).searchParams)
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos. Requeridos: lat, lng. Opcional: radius (50–3000 m).' },
        { status: 400 },
      )
    }
    const { lat, lng, radius } = parsed.data
    const alerts = (await listAlerts())
      .map((a) => ({ alert: a, distance: haversineMeters(lat, lng, a.lat, a.lng) }))
      .filter(({ distance }) => distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .map(({ alert, distance }) => ({
        id: alert.id,
        category: alert.category,
        severity: alert.severity,
        lat: Math.round(alert.lat * 1e4) / 1e4,
        lng: Math.round(alert.lng * 1e4) / 1e4,
        distanceMeters: Math.round(distance),
        occurredAt: alert.occurredAt,
        expiresAt: alert.expiresAt,
        confirmations: alert.confirmCount,
        flags: alert.flagCount,
      }))

    return NextResponse.json({ center: { lat, lng }, radiusMeters: radius, count: alerts.length, alerts })
  })
}
