'use client'

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useCallback, useMemo } from 'react'
import { startApiCheckout } from '@/app/actions/business'

const stripeByKey = new Map<string, Promise<Stripe | null>>()

function getStripe(publishableKey: string) {
  let promise = stripeByKey.get(publishableKey)
  if (!promise) {
    promise = loadStripe(publishableKey)
    stripeByKey.set(publishableKey, promise)
  }
  return promise
}

export function ApiCheckout({ publishableKey, company }: { publishableKey: string; company: string }) {
  const stripePromise = useMemo(() => getStripe(publishableKey), [publishableKey])
  const fetchClientSecret = useCallback(() => startApiCheckout(company), [company])

  return (
    <div id="checkout" className="min-h-96">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
