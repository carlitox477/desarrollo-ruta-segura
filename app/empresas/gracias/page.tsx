import { CheckCircle2, CircleAlert } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiAccounts } from '@/lib/db/schema'
import { stripe } from '@/lib/stripe'

async function confirmApiSubscription(sessionId: string, userId: string) {
  if (!stripe || !sessionId.startsWith('cs_')) return null

  const checkout = await stripe.checkout.sessions.retrieve(sessionId)
  if (checkout.client_reference_id !== userId || checkout.mode !== 'subscription') return null
  if (checkout.metadata?.plan !== 'api') return null
  if (checkout.status !== 'complete') return { complete: false as const }

  const company = checkout.metadata?.company ?? ''
  const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription?.id
  const customerId = typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id
  if (!company || !customerId) return null

  const values = {
    company,
    status: 'active',
    stripeSessionId: checkout.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId ?? null,
    updatedAt: new Date(),
  }
  await db
    .insert(apiAccounts)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: apiAccounts.userId, set: values })

  return { complete: true as const, company }
}

export default async function GraciasPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/empresas#api')

  const result = sessionId ? await confirmApiSubscription(sessionId, session.user.id) : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-5">
      {result?.complete ? (
        <>
          <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">API activada</h1>
          <p className="leading-relaxed text-muted-foreground">
            {result.company} ya tiene acceso a Ruta Segura API. Creá tu primera clave en la sección de empresas;
            Stripe te factura a fin de mes según las llamadas exitosas.
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
        <Link href="/empresas#api" className={buttonVariants()}>
          Crear API key
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Ir al mapa
        </Link>
      </div>
    </main>
  )
}
