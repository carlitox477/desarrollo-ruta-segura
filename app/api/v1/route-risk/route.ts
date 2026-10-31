import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listAlerts } from '@/lib/alerts/service'
import { withApiKey } from '@/lib/business/api-keys'
import { computeImpacts } from '@/lib/routing/scoring'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  coordinates: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(2000),
})

function riskLevel(penaltySeconds: number, impactCount: number) {
  if (impactCount === 0) return 'sin_alertas'
  if (penaltySeconds < 90) return 'bajo'
  if (penaltySeconds < 300) return 'moderado'
  return 'elevado'
}

export function POST(req: Request) {
  return withApiKey(req, 'POST /api/v1/route-risk', async () => {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Cuerpo inválido. Enviá { "coordinates": [[lng, lat], ...] } con 2 a 2000 puntos.' },
        { status: 400 },
      )
    }
    const impacts = computeImpacts(parsed.data.coordinates, await listAlerts())
    const penaltySeconds = impacts.reduce((sum, i) => sum + i.penaltySeconds, 0)

    return NextResponse.json({
      riskLevel: riskLevel(penaltySeconds, impacts.length),
      penaltySeconds,
      alerts: impacts.map((i) => ({
        id: i.alertId,
        category: i.category,
        severity: i.severity,
        distanceMeters: i.distanceMeters,
        ageHours: i.ageHours,
        weight: i.weight,
        segmentIndex: i.segmentIndex,
      })),
    })
  })
}
