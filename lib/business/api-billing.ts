import 'server-only'

import StripeSdk from 'stripe'
import type Stripe from 'stripe'
import { API_PLAN } from '@/lib/business/plans'
import { stripe } from '@/lib/stripe'

let pricePromise: Promise<string> | null = null

async function ensureMeter(client: Stripe) {
  const meters = await client.billing.meters.list({ status: 'active', limit: 100 })
  const existing = meters.data.find((m) => m.event_name === API_PLAN.meterEventName)
  if (existing) return existing.id

  const meter = await client.billing.meters.create({
    display_name: 'Llamadas a Ruta Segura API',
    event_name: API_PLAN.meterEventName,
    default_aggregation: { formula: 'sum' },
  })
  return meter.id
}

async function findOrCreatePrice(client: Stripe) {
  const found = await client.prices.list({ lookup_keys: [API_PLAN.priceLookupKey], active: true, limit: 1 })
  if (found.data[0]) return found.data[0].id

  const meterId = await ensureMeter(client)
  const price = await client.prices.create({
    currency: API_PLAN.currency,
    lookup_key: API_PLAN.priceLookupKey,
    product_data: { name: API_PLAN.name },
    recurring: { interval: 'month', usage_type: 'metered', meter: meterId },
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    tiers: [
      { up_to: API_PLAN.freeCallsPerMonth, unit_amount: 0 },
      { up_to: 'inf', unit_amount_decimal: StripeSdk.Decimal.from(API_PLAN.pricePerCallCents) },
    ],
  })
  return price.id
}

/** Metered price is created once in Stripe and reused through its lookup key. */
export function getApiPriceId() {
  if (!stripe) throw new Error('Los pagos todavía no están configurados.')
  if (!pricePromise) {
    pricePromise = findOrCreatePrice(stripe).catch((error) => {
      pricePromise = null
      throw error
    })
  }
  return pricePromise
}

export async function reportApiCall(customerId: string, usageId: number) {
  if (!stripe) return
  await stripe.billing.meterEvents.create({
    event_name: API_PLAN.meterEventName,
    identifier: `api-usage-${usageId}`,
    payload: { stripe_customer_id: customerId, value: '1' },
  })
}
