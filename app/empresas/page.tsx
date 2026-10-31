import { and, desc, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { DatasetPanel } from '@/components/empresas/dataset-panel'
import { FleetPlan } from '@/components/empresas/fleet-plan'
import { InsurerForm } from '@/components/empresas/insurer-form'
import { auth, isGoogleLoginConfigured } from '@/lib/auth'
import { getDatasetStats } from '@/lib/business/dataset'
import { db } from '@/lib/db'
import { fleetSubscriptions } from '@/lib/db/schema'
import { isStripeConfigured } from '@/lib/stripe'

export const metadata: Metadata = {
  title: 'Empresas — Ruta Segura CABA',
  description:
    'Datasets históricos de incidentes reportados en CABA para aseguradoras y suscripción por unidad para empresas de logística.',
}

export default async function EmpresasPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const [stats, activeSubscription] = await Promise.all([
    getDatasetStats(),
    session?.user
      ? db
          .select({ company: fleetSubscriptions.company, vehicles: fleetSubscriptions.vehicles })
          .from(fleetSubscriptions)
          .where(and(eq(fleetSubscriptions.userId, session.user.id), eq(fleetSubscriptions.status, 'active')))
          .orderBy(desc(fleetSubscriptions.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Mapa
            </Link>
            <span className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">
              Ruta Segura <span className="font-mono font-normal text-primary">Empresas</span>
            </span>
          </div>
          <nav aria-label="Secciones" className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            <a href="#aseguradoras" className="hover:text-foreground">
              Aseguradoras
            </a>
            <a href="#logistica" className="hover:text-foreground">
              Logística
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-5 py-10 md:py-14">
        <section className="flex max-w-2xl flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Datos de calle, en tiempo real</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Lo que la ciudad reporta, convertido en información para tu negocio.
          </h1>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Cada alerta en Ruta Segura la carga un vecino, la valida la comunidad y vence sola. Ese historial
            sirve para tarificar riesgo y para mover flotas por calles más seguras.
          </p>
        </section>

        <section id="aseguradoras" aria-labelledby="aseguradoras-title" className="grid scroll-mt-6 gap-8 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Para aseguradoras</p>
              <h2 id="aseguradoras-title" className="text-2xl font-semibold tracking-tight">
                Dataset histórico de denuncias
              </h2>
              <p className="text-pretty leading-relaxed text-muted-foreground">
                Todas las denuncias hechas en la app, con categoría, severidad, hora, validaciones de la comunidad y
                estado final. Anonimizadas: sin texto libre, sin identificadores de quien reporta y con
                coordenadas agregadas a ~110 m.
              </p>
            </div>
            <DatasetPanel stats={stats} />
          </div>
          <div className="lg:col-span-2">
            <InsurerForm defaultEmail={session?.user.email ?? ''} defaultName={session?.user.name ?? ''} />
          </div>
        </section>

        <section id="logistica" aria-labelledby="logistica-title" className="flex scroll-mt-6 flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Para logística</p>
            <h2 id="logistica-title" className="text-2xl font-semibold tracking-tight">
              Suscripción por unidad de transporte
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Tus choferes reciben rutas que esquivan zonas con alertas recientes, en auto o a pie para la última
              cuadra. Pagás solo por las unidades activas y podés cambiar la cantidad cuando quieras.
            </p>
          </div>
          <FleetPlan
            signedIn={Boolean(session?.user)}
            googleEnabled={isGoogleLoginConfigured}
            paymentsEnabled={isStripeConfigured}
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
            activeSubscription={activeSubscription}
          />
        </section>
      </main>
    </div>
  )
}
