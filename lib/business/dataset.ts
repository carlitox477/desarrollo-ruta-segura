import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { CATEGORY_CONFIG } from '@/lib/alerts/config'
import { db } from '@/lib/db'
import { alerts } from '@/lib/db/schema'
import type { AlertCategory } from '@/lib/types'

export type DatasetStats = {
  total: number
  firstReportAt: string | null
  byCategory: { category: AlertCategory; label: string; count: number }[]
  byStatus: { active: number; withdrawn: number; dismissed: number; expired: number }
  byHour: number[]
}

export async function getDatasetStats(): Promise<DatasetStats> {
  const realAlerts = eq(alerts.isDemo, false)

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int`, first: sql<Date | null>`min(${alerts.occurredAt})` })
    .from(alerts)
    .where(realAlerts)

  const categoryRows = await db
    .select({ category: alerts.category, count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(realAlerts)
    .groupBy(alerts.category)

  const statusRows = await db
    .select({
      status: sql<string>`case when ${alerts.status} = 'active' and ${alerts.expiresAt} < now() then 'expired' else ${alerts.status} end`,
      count: sql<number>`count(*)::int`,
    })
    .from(alerts)
    .where(realAlerts)
    .groupBy(sql`1`)

  const hourRows = await db
    .select({
      hour: sql<number>`extract(hour from ${alerts.occurredAt} at time zone 'America/Argentina/Buenos_Aires')::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(alerts)
    .where(realAlerts)
    .groupBy(sql`1`)

  const byHour = Array.from({ length: 24 }, () => 0)
  for (const row of hourRows) byHour[row.hour] = row.count

  const byStatus = { active: 0, withdrawn: 0, dismissed: 0, expired: 0 }
  for (const row of statusRows) {
    if (row.status in byStatus) byStatus[row.status as keyof typeof byStatus] += row.count
  }

  const counts = new Map(categoryRows.map((r) => [r.category, r.count]))
  const byCategory = (Object.keys(CATEGORY_CONFIG) as AlertCategory[])
    .map((category) => ({ category, label: CATEGORY_CONFIG[category].label, count: counts.get(category) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  return {
    total: totals?.total ?? 0,
    firstReportAt: totals?.first ? new Date(totals.first).toISOString() : null,
    byCategory,
    byStatus,
    byHour,
  }
}

const SAMPLE_LIMIT = 200

// Coordinates are rounded to ~110 m and times to the hour so a sample row cannot
// be traced back to a reporter. Free-text descriptions are never exported.
export async function getAnonymizedSample() {
  return db
    .select({
      id: alerts.id,
      category: alerts.category,
      severity: alerts.severity,
      lat: sql<number>`round(${alerts.lat}::numeric, 3)::float8`,
      lng: sql<number>`round(${alerts.lng}::numeric, 3)::float8`,
      occurredHour: sql<string>`to_char(date_trunc('hour', ${alerts.occurredAt} at time zone 'America/Argentina/Buenos_Aires'), 'YYYY-MM-DD"T"HH24:00')`,
      status: alerts.status,
      confirmations: alerts.confirmCount,
      flags: alerts.flagCount,
      isDemo: alerts.isDemo,
    })
    .from(alerts)
    .orderBy(asc(alerts.occurredAt))
    .limit(SAMPLE_LIMIT)
}
