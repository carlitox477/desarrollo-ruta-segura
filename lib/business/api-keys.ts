import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { after, NextResponse } from 'next/server'
import { reportApiCall } from '@/lib/business/api-billing'
import { API_PLAN } from '@/lib/business/plans'
import { db } from '@/lib/db'
import { apiAccounts, apiKeys, apiUsage } from '@/lib/db/schema'

const KEY_PREFIX = 'rs_live_'

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 6), hash: hashApiKey(key) }
}

type ApiCaller = { keyId: number; userId: string; customerId: string }

function apiError(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

async function authenticate(req: Request): Promise<ApiCaller | NextResponse> {
  const header = req.headers.get('authorization') ?? ''
  const key = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!key.startsWith(KEY_PREFIX)) return apiError(401, 'Falta la API key. Usá el header Authorization: Bearer <key>.')

  const [row] = await db
    .select({
      keyId: apiKeys.id,
      userId: apiKeys.userId,
      status: apiAccounts.status,
      customerId: apiAccounts.stripeCustomerId,
    })
    .from(apiKeys)
    .innerJoin(apiAccounts, eq(apiAccounts.userId, apiKeys.userId))
    .where(and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)))
    .limit(1)

  if (!row) return apiError(401, 'API key inválida o revocada.')
  if (row.status !== 'active' || !row.customerId) return apiError(402, 'La cuenta no tiene un plan de API activo.')

  const [{ value: recentCalls }] = await db
    .select({ value: count() })
    .from(apiUsage)
    .where(and(eq(apiUsage.keyId, row.keyId), gt(apiUsage.createdAt, new Date(Date.now() - 60_000))))
  if (recentCalls >= API_PLAN.rateLimitPerMinute) {
    return apiError(429, `Límite de ${API_PLAN.rateLimitPerMinute} llamadas por minuto alcanzado.`)
  }

  return { keyId: row.keyId, userId: row.userId, customerId: row.customerId }
}

/**
 * Authenticates the request with an API key, runs the handler, and records the call.
 * Only 2xx responses are reported to Stripe, so callers never pay for errors.
 */
export async function withApiKey(req: Request, endpoint: string, handler: () => Promise<NextResponse>) {
  const caller = await authenticate(req)
  if (caller instanceof NextResponse) return caller

  let response: NextResponse
  try {
    response = await handler()
  } catch (error) {
    console.error(`[api] ${endpoint} failed`, error)
    response = apiError(500, 'Error interno. La llamada no se factura.')
  }

  const statusCode = response.status
  after(async () => {
    try {
      const [usage] = await db
        .insert(apiUsage)
        .values({ keyId: caller.keyId, userId: caller.userId, endpoint, statusCode })
        .returning({ id: apiUsage.id })
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, caller.keyId))
      if (statusCode >= 200 && statusCode < 300) await reportApiCall(caller.customerId, usage.id)
    } catch (error) {
      console.error('[api] usage recording failed', error)
    }
  })

  return response
}
