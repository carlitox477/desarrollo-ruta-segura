'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'
import { AccountButton } from '@/components/ruta-segura/account-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_PLAN, estimateMonthlyCost, formatUsd, PRICE_PER_CALL_USD } from '@/lib/business/plans'
import { ApiCheckout } from './api-checkout'
import { ApiKeysPanel, type ApiKeyRow } from './api-keys-panel'

const INCLUDED = [
  'Alertas activas alrededor de un punto, con severidad y validaciones',
  'Puntaje de riesgo para cualquier recorrido que envíes',
  `Las primeras ${API_PLAN.freeCallsPerMonth.toLocaleString('es-AR')} llamadas del mes no se cobran`,
  'Las respuestas con error no se facturan',
]

const VOLUMES = [10_000, 100_000, 1_000_000]

export function ApiPlan({
  signedIn,
  googleEnabled,
  paymentsEnabled,
  publishableKey,
  account,
  keys,
  monthlyCalls,
}: {
  signedIn: boolean
  googleEnabled: boolean
  paymentsEnabled: boolean
  publishableKey: string
  account: { company: string } | null
  keys: ApiKeyRow[]
  monthlyCalls: number
}) {
  const [company, setCompany] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const canCheckout = signedIn && paymentsEnabled && company.trim().length > 0

  return (
    <div className="grid gap-6 rounded-lg border border-border bg-card p-5 md:grid-cols-2 md:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-4xl font-medium">{formatUsd(PRICE_PER_CALL_USD, 3)}</span>
          <span className="text-sm text-muted-foreground">por llamada · sin mínimo mensual</span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
          {VOLUMES.map((calls) => (
            <div key={calls} className="flex flex-col gap-0.5 bg-card p-3">
              <dt className="text-xs text-muted-foreground">{calls.toLocaleString('es-AR')} llamadas</dt>
              <dd className="font-mono">{formatUsd(estimateMonthlyCost(calls))}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
        {account ? (
          <ApiKeysPanel company={account.company} keys={keys} monthlyCalls={monthlyCalls} />
        ) : !signedIn ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ingresá para activar el plan y generar tus API keys.
            </p>
            {googleEnabled ? (
              <AccountButton googleEnabled={googleEnabled} />
            ) : (
              <p className="text-sm text-muted-foreground">El ingreso con Google todavía no está configurado.</p>
            )}
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canCheckout) setCheckoutOpen(true)
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="api-company">Empresa</Label>
              <Input
                id="api-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Logística del Sur S.A."
                maxLength={120}
                autoComplete="organization"
                required
              />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Registrás una tarjeta y Stripe te factura a fin de mes según las llamadas exitosas. Podés cancelar
              cuando quieras.
            </p>
            <Button type="submit" disabled={!canCheckout}>
              Activar acceso a la API
            </Button>
            {!paymentsEnabled ? (
              <p className="text-sm text-muted-foreground">Los pagos todavía no están configurados.</p>
            ) : null}
          </form>
        )}
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Activar Ruta Segura API</DialogTitle>
            <DialogDescription>
              {company.trim()} · {formatUsd(PRICE_PER_CALL_USD, 3)} por llamada después de las primeras{' '}
              {API_PLAN.freeCallsPerMonth.toLocaleString('es-AR')}.
            </DialogDescription>
          </DialogHeader>
          {checkoutOpen ? <ApiCheckout publishableKey={publishableKey} company={company} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
