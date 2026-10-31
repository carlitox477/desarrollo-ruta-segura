'use server'

import { createHash } from 'node:crypto'
import { and, count, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getApiPriceId } from '@/lib/business/api-billing'
import { generateApiKey } from '@/lib/business/api-keys'
import { API_PLAN } from '@/lib/business/plans'
import { db } from '@/lib/db'
import { apiAccounts, apiKeys, datasetRequests } from '@/lib/db/schema'
import { stripe } from '@/lib/stripe'

export type DatasetRequestState = { ok: boolean; message: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function field(formData: FormData, name: string, max: number) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Ingresá con tu cuenta para continuar.')
  return session.user
}

export async function requestDatasetAccess(
  _prev: DatasetRequestState,
  formData: FormData,
): Promise<DatasetRequestState> {
  const company = field(formData, 'company', 120)
  const contactName = field(formData, 'contactName', 120)
  const email = field(formData, 'email', 160).toLowerCase()
  const useCase = field(formData, 'useCase', 600)

  if (!company || !contactName || !EMAIL_RE.test(email)) {
    return { ok: false, message: 'Completá empresa, nombre y un email válido.' }
  }

  const session = await auth.api.getSession({ headers: await headers() })

  try {
    await db.insert(datasetRequests).values({
      company,
      contactName,
      email,
      useCase: useCase || null,
      userId: session?.user.id ?? null,
    })
  } catch (error) {
    console.error('Dataset request insert failed:', error)
    return { ok: false, message: 'No pudimos registrar la solicitud. Probá de nuevo.' }
  }

  return { ok: true, message: 'Solicitud recibida. Te contactamos en 48 h hábiles con las condiciones de licencia.' }
}

export async function startApiCheckout(company: string) {
  if (!stripe) throw new Error('Los pagos todavía no están configurados.')
  const companyName = company.trim().slice(0, 120)
  if (!companyName) throw new Error('Indicá el nombre de la empresa.')

  const user = await requireUser()
  const [existing] = await db
    .select({ status: apiAccounts.status })
    .from(apiAccounts)
    .where(eq(apiAccounts.userId, user.id))
    .limit(1)
  if (existing?.status === 'active') throw new Error('Tu cuenta ya tiene el plan de API activo.')

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const origin = requestHeaders.get('origin') ?? `${protocol}://${host}`

  const priceId = await getApiPriceId()
  const metadata = { userId: user.id, company: companyName, plan: 'api' }

  // Retries or double clicks within the same 10-minute window reuse one Checkout Session.
  const windowBucket = Math.floor(Date.now() / (10 * 60 * 1000))
  const idempotencyKey = createHash('sha256').update(`api:${user.id}:${companyName}:${windowBucket}`).digest('hex')

  const checkout = await stripe.checkout.sessions.create(
    {
      ui_mode: 'embedded_page',
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      return_url: `${origin}/empresas/gracias?session_id={CHECKOUT_SESSION_ID}`,
      line_items: [{ price: priceId }],
      metadata,
      subscription_data: { metadata },
    },
    { idempotencyKey },
  )

  if (!checkout.client_secret) throw new Error('Stripe no devolvió una sesión de pago.')
  return checkout.client_secret
}

export type CreateKeyResult = { ok: true; key: string } | { ok: false; message: string }

export async function createApiKey(name: string): Promise<CreateKeyResult> {
  const user = await requireUser()
  const label = name.trim().slice(0, 60) || 'Clave sin nombre'

  const [account] = await db
    .select({ status: apiAccounts.status })
    .from(apiAccounts)
    .where(eq(apiAccounts.userId, user.id))
    .limit(1)
  if (account?.status !== 'active') return { ok: false, message: 'Activá el plan de API antes de crear claves.' }

  const [{ value: activeKeys }] = await db
    .select({ value: count() })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
  if (activeKeys >= API_PLAN.maxActiveKeys) {
    return { ok: false, message: `Podés tener hasta ${API_PLAN.maxActiveKeys} claves activas. Revocá una primero.` }
  }

  const { key, prefix, hash } = generateApiKey()
  await db.insert(apiKeys).values({ userId: user.id, name: label, prefix, keyHash: hash })
  revalidatePath('/empresas')
  return { ok: true, key }
}

export async function revokeApiKey(keyId: number) {
  const user = await requireUser()
  if (!Number.isInteger(keyId)) return
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
  revalidatePath('/empresas')
}
