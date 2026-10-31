'use client'

import { Check, Minus, Plus, Truck } from 'lucide-react'
import { useState } from 'react'
import { AccountButton } from '@/components/ruta-segura/account-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FLEET_PLAN, formatUsd } from '@/lib/business/plans'
import { FleetCheckout } from './fleet-checkout'

const INCLUDED = [
  'Rutas en auto que penalizan zonas con alertas activas',
  'Alertas comunitarias y datos oficiales de CABA en el mapa',
  'Cancelás o cambiás la cantidad de unidades cuando quieras',
]

function clampVehicles(value: number) {
  if (!Number.isFinite(value)) return FLEET_PLAN.minVehicles
  return Math.min(FLEET_PLAN.maxVehicles, Math.max(FLEET_PLAN.minVehicles, Math.round(value)))
}

export function FleetPlan({
  signedIn,
  googleEnabled,
  paymentsEnabled,
  publishableKey,
  activeSubscription,
}: {
  signedIn: boolean
  googleEnabled: boolean
  paymentsEnabled: boolean
  publishableKey: string
  activeSubscription: { company: string; vehicles: number } | null
}) {
  const [vehicles, setVehicles] = useState(10)
  const [company, setCompany] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const totalCents = vehicles * FLEET_PLAN.pricePerVehicleCents
  const canCheckout = signedIn && paymentsEnabled && company.trim().length > 0

  return (
    <div className="grid gap-6 rounded-lg border border-border bg-card p-5 md:grid-cols-2 md:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-medium">{formatUsd(FLEET_PLAN.pricePerVehicleCents)}</span>
          <span className="text-sm text-muted-foreground">por unidad / mes</span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {activeSubscription ? (
        <div className="flex flex-col items-start gap-2 rounded-md bg-muted p-4" role="status">
          <Truck className="size-5 text-primary" aria-hidden="true" />
          <p className="font-medium">Suscripción activa</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {activeSubscription.company}: {activeSubscription.vehicles}{' '}
            {activeSubscription.vehicles === 1 ? 'unidad' : 'unidades'} por{' '}
            {formatUsd(activeSubscription.vehicles * FLEET_PLAN.pricePerVehicleCents)} al mes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fleet-company">Empresa</Label>
            <Input
              id="fleet-company"
              value={company}
              maxLength={120}
              autoComplete="organization"
              placeholder="Logística del Sur S.A."
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fleet-vehicles">Unidades de transporte</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Quitar una unidad"
                disabled={vehicles <= FLEET_PLAN.minVehicles}
                onClick={() => setVehicles((v) => clampVehicles(v - 1))}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Input
                id="fleet-vehicles"
                type="number"
                inputMode="numeric"
                min={FLEET_PLAN.minVehicles}
                max={FLEET_PLAN.maxVehicles}
                value={vehicles}
                className="w-24 text-center font-mono"
                onChange={(e) => setVehicles(clampVehicles(Number(e.target.value)))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Agregar una unidad"
                disabled={vehicles >= FLEET_PLAN.maxVehicles}
                onClick={() => setVehicles((v) => clampVehicles(v + 1))}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Total mensual</span>
            <span className="font-mono text-xl font-medium" aria-live="polite">
              {formatUsd(totalCents)}
            </span>
          </div>

          {!paymentsEnabled ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Los pagos se habilitan en cuanto termine de configurarse Stripe.
            </p>
          ) : !signedIn ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Ingresá para asociar la suscripción a tu cuenta.</p>
              <AccountButton googleEnabled={googleEnabled} />
            </div>
          ) : (
            <Button type="button" size="lg" disabled={!canCheckout} onClick={() => setCheckoutOpen(true)}>
              Suscribir {vehicles} {vehicles === 1 ? 'unidad' : 'unidades'}
            </Button>
          )}
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Suscripción para {company.trim() || 'tu empresa'}</DialogTitle>
            <DialogDescription>
              {vehicles} {vehicles === 1 ? 'unidad' : 'unidades'} × {formatUsd(FLEET_PLAN.pricePerVehicleCents)} ={' '}
              {formatUsd(totalCents)} por mes. Pago seguro con Stripe.
            </DialogDescription>
          </DialogHeader>
          {checkoutOpen && <FleetCheckout publishableKey={publishableKey} vehicles={vehicles} company={company} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
