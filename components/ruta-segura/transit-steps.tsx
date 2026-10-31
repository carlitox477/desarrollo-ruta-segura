'use client'

import { Bus, Footprints, TrainFront, TramFront } from 'lucide-react'
import type { TransitStep, TransitVehicle } from '@/lib/types'
import { fmtDist, fmtMin, MAP_COLORS } from './client'

const VEHICLE: Record<TransitVehicle, { label: string; Icon: typeof Bus }> = {
  colectivo: { label: 'Colectivo', Icon: Bus },
  subte: { label: 'Subte', Icon: TrainFront },
  tren: { label: 'Tren', Icon: TrainFront },
  premetro: { label: 'Premetro', Icon: TramFront },
}

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    : null

export function LineBadge({ step }: { step: Extract<TransitStep, { kind: 'transit' }> }) {
  const { Icon } = VEHICLE[step.vehicle]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-xs font-semibold"
      style={{ background: step.color ?? MAP_COLORS.primary, color: step.textColor ?? MAP_COLORS.ink }}
    >
      <Icon className="size-3" aria-hidden />
      {step.lineShort}
    </span>
  )
}

/** Compact one-line summary: walk > 10 > walk > subte D */
export function TransitSummary({ steps }: { steps: TransitStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>›</span>}
          {s.kind === 'walk' ? (
            <span className="inline-flex items-center gap-0.5 font-mono">
              <Footprints className="size-3" aria-hidden />
              <span className="sr-only">Caminar</span>
              {fmtMin(s.durationSeconds)}
            </span>
          ) : (
            <LineBadge step={s} />
          )}
        </span>
      ))}
    </div>
  )
}

export function TransitDetail({ steps }: { steps: TransitStep[] }) {
  return (
    <ol className="flex flex-col gap-2 border-t border-border pt-2 text-sm">
      {steps.map((s, i) =>
        s.kind === 'walk' ? (
          <li key={i} className="flex items-center gap-2 text-muted-foreground">
            <Footprints className="size-4 shrink-0" aria-hidden />
            <span>
              Caminar {fmtMin(s.durationSeconds)} <span className="font-mono text-xs">({fmtDist(s.distanceMeters)})</span>
            </span>
          </li>
        ) : (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <LineBadge step={s} />
              <span className="text-foreground">
                {VEHICLE[s.vehicle].label}
                {s.headsign && <span className="text-muted-foreground"> hacia {s.headsign}</span>}
              </span>
            </div>
            <p className="pl-1 font-mono text-xs leading-relaxed text-muted-foreground">
              {fmtTime(s.departureTime) && <span className="text-primary">{fmtTime(s.departureTime)} </span>}
              {s.from ?? 'Parada'} → {s.to ?? 'parada'}
              {s.stopCount != null && ` · ${s.stopCount} paradas`} · {fmtMin(s.durationSeconds)}
            </p>
          </li>
        ),
      )}
    </ol>
  )
}
