import 'server-only'
import { and, desc, eq, gt, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { alertFlags, alerts, type AlertRow } from '@/lib/db/schema'
import { haversineMeters } from '@/lib/geo'
import type { Alert, AlertCategory, AlertStatus } from '@/lib/types'
import { ABUSE_LIMITS, CATEGORIES, CATEGORY_CONFIG, isInsideCaba } from './config'

export const createAlertSchema = z.object({
  category: z.enum(CATEGORIES as [AlertCategory, ...AlertCategory[]]),
  severity: z.number().int().min(1).max(5),
  lat: z.number().finite(),
  lng: z.number().finite(),
  description: z
    .string()
    .trim()
    .max(ABUSE_LIMITS.descriptionMaxLength)
    .optional()
    .transform((v) => (v ? v : undefined)),
  occurredAt: z.string().datetime().optional(),
})

export type CreateAlertInput = z.infer<typeof createAlertSchema>

function toAlert(row: AlertRow, now = Date.now()): Alert {
  let status = row.status as AlertStatus
  if (status === 'active' && row.expiresAt.getTime() <= now) status = 'expired'
  return {
    id: row.id,
    category: row.category as AlertCategory,
    severity: row.severity,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    status,
    isDemo: row.isDemo,
    flagCount: row.flagCount,
    confirmCount: row.confirmCount,
  }
}

export async function listAlerts({ includeInactive = false } = {}) {
  const since = new Date(Date.now() - 7 * 24 * 3_600_000)
  const rows = await db
    .select()
    .from(alerts)
    .where(includeInactive ? gte(alerts.createdAt, since) : and(eq(alerts.status, 'active'), gt(alerts.expiresAt, new Date())))
    .orderBy(desc(alerts.createdAt))
    .limit(500)
  return rows.map((r) => toAlert(r))
}

export class AlertError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const PII_PATTERN = /(\b\d{7,}\b)|(@\w+)|(\b(dni|patente|celular|tel[eé]fono)\b)/i

export async function createAlert(input: CreateAlertInput, reporterHash: string) {
  if (!isInsideCaba(input.lat, input.lng)) {
    throw new AlertError('La ubicación debe estar dentro de CABA.', 400)
  }
  if (input.description && PII_PATTERN.test(input.description)) {
    throw new AlertError(
      'La descripción no puede incluir datos personales, teléfonos, patentes ni menciones a personas.',
      400,
    )
  }

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()
  const now = Date.now()
  if (occurredAt.getTime() > now + 5 * 60_000) {
    throw new AlertError('La fecha del incidente no puede ser futura.', 400)
  }
  const cfg = CATEGORY_CONFIG[input.category]
  const expiresAt = new Date(occurredAt.getTime() + cfg.ttlHours * 3_600_000)
  if (expiresAt.getTime() <= now) {
    throw new AlertError(`Un reporte de "${cfg.label}" de esa fecha ya estaría vencido.`, 400)
  }

  const windowStart = new Date(now - ABUSE_LIMITS.windowMinutes * 60_000)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(eq(alerts.reporterHash, reporterHash), gte(alerts.createdAt, windowStart)))
  if (count >= ABUSE_LIMITS.maxReportsPerWindow) {
    throw new AlertError(
      `Llegaste al límite de ${ABUSE_LIMITS.maxReportsPerWindow} reportes cada ${ABUSE_LIMITS.windowMinutes} minutos. Probá más tarde.`,
      429,
    )
  }

  const dupStart = new Date(now - ABUSE_LIMITS.duplicateWindowMinutes * 60_000)
  const candidates = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.category, input.category),
        eq(alerts.status, 'active'),
        gte(alerts.createdAt, dupStart),
        sql`abs(${alerts.lat} - ${input.lat}) < 0.002 and abs(${alerts.lng} - ${input.lng}) < 0.002`,
      ),
    )
  const duplicate = candidates.find(
    (c) => haversineMeters(c.lat, c.lng, input.lat, input.lng) <= ABUSE_LIMITS.duplicateRadiusMeters,
  )
  if (duplicate) {
    if (duplicate.reporterHash === reporterHash) {
      throw new AlertError('Ya reportaste un incidente similar en este lugar hace poco.', 409)
    }
    const [updated] = await db
      .update(alerts)
      .set({ confirmCount: sql`${alerts.confirmCount} + 1` })
      .where(eq(alerts.id, duplicate.id))
      .returning()
    return { alert: toAlert(updated), duplicateOf: duplicate.id }
  }

  const [row] = await db
    .insert(alerts)
    .values({
      category: input.category,
      severity: input.severity,
      description: input.description ?? null,
      lat: input.lat,
      lng: input.lng,
      occurredAt,
      expiresAt,
      reporterHash,
    })
    .returning()
  return { alert: toAlert(row), duplicateOf: null as number | null }
}

export async function flagAlert(alertId: number, reporterHash: string) {
  const [existing] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1)
  if (!existing) throw new AlertError('La alerta no existe.', 404)
  if (existing.reporterHash === reporterHash) {
    throw new AlertError('No podés marcar como falsa tu propia alerta.', 400)
  }
  const inserted = await db
    .insert(alertFlags)
    .values({ alertId, reporterHash })
    .onConflictDoNothing()
    .returning({ id: alertFlags.id })
  if (inserted.length === 0) throw new AlertError('Ya marcaste esta alerta.', 409)

  const [updated] = await db
    .update(alerts)
    .set({
      flagCount: sql`${alerts.flagCount} + 1`,
      status: sql`case when ${alerts.flagCount} + 1 >= ${ABUSE_LIMITS.flagsToDismiss} then 'dismissed' else ${alerts.status} end`,
    })
    .where(eq(alerts.id, alertId))
    .returning()
  return toAlert(updated)
}
