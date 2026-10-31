'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { FLEET_PLAN, isValidVehicleCount } from '@/lib/business/plans'
import { db } from '@/lib/db'
import { datasetRequests } from '@/lib/db/schema'
import { stripe } from '@/lib/stripe'

export type DatasetRequestState = { ok: boolean; message: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function field(formData: FormData, name: string, max: number) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
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

export async function startFleetCheckout(vehicles: number, company: string) {
  if (!stripe) throw new Error('Los pagos todavía no están configurados.')
  if (!isValidVehicleCount(vehicles)) {
    throw new Error(`La cantidad de unidades debe estar entre ${FLEET_PLAN.minVehicles} y ${FLEET_PLAN.maxVehicles}.`)
  }
  const companyName = company.trim().slice(0, 120)
  if (!companyName) throw new Error('Indicá el nombre de la empresa.')

  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user) throw new Error('Ingresá con tu cuenta para suscribirte.')

  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const origin = requestHeaders.get('origin') ?? `${protocol}://${host}`

  const metadata = { userId: session.user.id, company: companyName, vehicles: String(vehicles) }

  // Same user + company + vehicle count within a 10-minute window reuses the same
  // Checkout Session, so a double click or retry cannot open two subscriptions.
  const windowBucket = Math.floor(Date.now() / (10 * 60 * 1000))
  const idempotencyKey = createHash('sha256')
    .update(`${session.user.id}:${companyName}:${vehicles}:${windowBucket}`)
    .digest('hex')

  const checkout = await stripe.checkout.sessions.create(
    {
      ui_mode: 'embedded_page',
      mode: 'subscription',
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      return_url: `${origin}/empresas/gracias?session_id={CHECKOUT_SESSION_ID}`,
      line_items: [
        {
          price_data: {
            currency: FLEET_PLAN.currency,
            unit_amount: FLEET_PLAN.pricePerVehicleCents,
            recurring: { interval: 'month' },
            product_data: { name: FLEET_PLAN.name, description: FLEET_PLAN.description },
          },
          quantity: vehicles,
        },
      ],
      metadata,
      subscription_data: { metadata },
    },
    { idempotencyKey },
  )

  if (!checkout.client_secret) throw new Error('Stripe no devolvió una sesión de pago.')
  return checkout.client_secret
}
