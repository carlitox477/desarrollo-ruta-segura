'use client'

import { CATEGORY_CONFIG } from '@/lib/alerts/config'
import type { ScoredRoute } from '@/lib/types'
import { cn } from '@/lib/utils'
import { fmtDist, fmtMin } from './client'

const RISK_LABEL: Record<ScoredRoute['riskLevel'], string> = {
  sin_datos: 'Sin alertas cercanas',
  bajo: 'Pocas alertas',
  moderado: 'Alertas moderadas',
  elevado: 'Muchas alertas',
}

export function RouteList({
  routes,
  selectedId,
  onSelect,
}: {
  routes: ScoredRoute[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const active = selectedId ?? routes[0]?.id
  return (
    <ul className="flex flex-col gap-2" aria-label="Rutas candidatas">
      {routes.map((r) => {
        const isSel = r.id === active
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              aria-pressed={isSel}
              className={cn(
                'flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors',
                isSel ? 'border-primary bg-card' : 'border-border hover:border-muted-foreground',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm font-semibold', r.recommended && 'text-primary')}>{r.label}</span>
                <span
                  className={cn(
                    'font-mono text-xs',
                    r.riskLevel === 'elevado' || r.riskLevel === 'moderado' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {RISK_LABEL[r.riskLevel]}
                </span>
              </div>
              <div className="flex items-baseline gap-4 font-mono text-sm">
                <span>
                  <span className="text-lg font-medium text-foreground">{fmtMin(r.durationSeconds)}</span>
                </span>
                <span className="text-muted-foreground">{fmtDist(r.distanceMeters)}</span>
                <span className="text-muted-foreground">
                  costo {fmtMin(r.cost)}
                  {r.alertPenaltySeconds > 0 && <span className="text-destructive"> (+{fmtMin(r.alertPenaltySeconds)})</span>}
                </span>
              </div>
              {isSel && (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{r.explanation}</p>
                  {r.impacts.length > 0 && (
                    <ul className="flex flex-col gap-1 border-t border-border pt-2 font-mono text-xs text-muted-foreground">
                      {r.impacts.map((i) => (
                        <li key={i.alertId} className="flex justify-between gap-2">
                          <span>
                            {CATEGORY_CONFIG[i.category].label} · sev {i.severity}
                            {i.isDemo && ' · demo'}
                          </span>
                          <span>
                            a {i.distanceMeters} m · +{Math.round(i.penaltySeconds / 60)} min
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
