import { CheckCircle2, CircleAlert } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { auth } from '@/lib/auth'
import { FLEET_PLAN, formatUsd, isValidVehicleCount } from '@/lib/business/plans'
import { db } from '@/lib/db'
import { fleetSubscriptions } from '@/lib/db/schema'
import { stripe } from '@/lib/stripe'

async function confirmSubscription(sessionId: string, userId: string) {
  if (!stripe || !sessionId.startsWith('cs_')) return null

  const checkout = await stripe.checkout.sessions.retrieve(sessionId)
  if (checkout.client_reference_id !== userId || checkout.mode !== 'subscription') return null
  if (checkout.status !== 'complete') return { complete: false as const }

  const vehicles = Number(checkout.metadata?.vehicles)
  const company = checkout.metadata?.company ?? ''
  if (!isValidVehicleCount(vehicles) || !company) return null

  const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription?.id
  const customerId = typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id

  await db
    .insert(fleetSubscriptions)
    .values({
      userId,
      company,
      vehicles,
      status: 'active',
      stripeSessionId: checkout.id,
      stripeSubscriptionId: subscriptionId ?? null,
      stripeCustomerId: customerId ?? null,
    })
    .onConflictDoNothing({ target: fleetSubscriptions.stripeSessionId })

  return { complete: true as const, vehicles, company }
}

export default async function GraciasPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/empresas#logistica')

  const result = sessionId ? await confirmSubscription(sessionId, session.user.id) : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-5">
      {result?.complete ? (
        <>
          <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">Suscripción activa</h1>
          <p className="leading-relaxed text-muted-foreground">
            {result.company} quedó suscripta con {result.vehicles} {result.vehicles === 1 ? 'unidad' : 'unidades'} por{' '}
            {formatUsd(result.vehicles * FLEET_PLAN.pricePerVehicleCents)} al mes. Te enviamos el recibo por email.
          </p>
        </>
      ) : (
        <>
          <CircleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">No pudimos confirmar el pago</h1>
          <p className="leading-relaxed text-muted-foreground">
            {result && !result.complete
              ? 'El pago todavía no se completó. Podés volver a intentarlo.'
              : 'El enlace no corresponde a una suscripción de tu cuenta.'}
          </p>
        </>
      )}
      <div className="flex gap-2">
        <Link href="/" className={buttonVariants()}>
          Ir al mapa
        </Link>
        <Link href="/empresas" className={buttonVariants({ variant: 'outline' })}>
          Empresas
        </Link>
      </div>
    </main>
  )
}
