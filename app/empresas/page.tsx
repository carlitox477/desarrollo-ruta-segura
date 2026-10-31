import { and, count, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { DatasetPanel } from '@/components/empresas/dataset-panel'
import { ApiPlan } from '@/components/empresas/api-plan'
import { ApiReference } from '@/components/empresas/api-reference'
import { InsurerForm } from '@/components/empresas/insurer-form'
import { auth, isGoogleLoginConfigured } from '@/lib/auth'
import { getDatasetStats } from '@/lib/business/dataset'
import { db } from '@/lib/db'
import { apiAccounts, apiKeys, apiUsage } from '@/lib/db/schema'
import { isStripeConfigured } from '@/lib/stripe'

export const metadata: Metadata = {
  title: 'Empresas — Ruta Segura CABA',
  description:
    'Datasets históricos de incidentes reportados en CABA para aseguradoras y API de integración directa con cobro por llamada.',
}

export default async function EmpresasPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user.id
  const [stats, account] = await Promise.all([
    getDatasetStats(),
    userId
      ? db
          .select({ company: apiAccounts.company })
          .from(apiAccounts)
          .where(and(eq(apiAccounts.userId, userId), eq(apiAccounts.status, 'active')))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const [keys, monthlyCalls] =
    account && userId
      ? await Promise.all([
          db
            .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt })
            .from(apiKeys)
            .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
            .orderBy(desc(apiKeys.createdAt))
            .then((rows) => rows.map((r) => ({ ...r, lastUsedAt: r.lastUsedAt?.toISOString() ?? null }))),
          db
            .select({ value: count() })
            .from(apiUsage)
            .where(and(eq(apiUsage.userId, userId), gte(apiUsage.createdAt, monthStart), gte(apiUsage.statusCode, 200), lt(apiUsage.statusCode, 300)))
            .then((rows) => rows[0]?.value ?? 0),
        ])
      : [[], 0]

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
            <a href="#api" className="hover:text-foreground">
              API
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

        <section id="api" aria-labelledby="api-title" className="flex scroll-mt-6 flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Para integraciones</p>
            <h2 id="api-title" className="text-2xl font-semibold tracking-tight">
              API de integración directa
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Conectá tu sistema de despacho, app de reparto o motor de tarificación a las alertas de Ruta
              Segura. Pagás solo por las llamadas exitosas, sin mínimo mensual.
            </p>
          </div>
          <ApiPlan
            signedIn={Boolean(session?.user)}
            googleEnabled={isGoogleLoginConfigured}
            paymentsEnabled={isStripeConfigured}
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
            account={account}
            keys={keys}
            monthlyCalls={monthlyCalls}
          />
          <ApiReference />
        </section>
      </main>
    </div>
  )
}
