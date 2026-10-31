import 'server-only'

import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY?.trim()

export const isStripeConfigured = Boolean(secretKey && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

export const stripe = secretKey ? new Stripe(secretKey) : null
