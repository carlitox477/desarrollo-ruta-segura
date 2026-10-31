'use client'

import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import type { Alert } from '@/lib/types'

type Props = {
  alert: Alert
  onFlag: (id: number) => Promise<void>
  onWithdraw: (id: number) => Promise<void>
}

type Action = 'flag' | 'withdraw'

const btn = 'rounded-sm border px-2 py-1 text-xs disabled:opacity-50'

export function AlertActions({ alert, onFlag, onWithdraw }: Props) {
  const [confirming, setConfirming] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Leaflet treats clicks it can't trace back to the popup as map clicks and closes the popup.
  useEffect(() => {
    if (rootRef.current) L.DomEvent.disableClickPropagation(rootRef.current)
  }, [])

  if (alert.isDemo) {
    return <p className="text-xs text-muted-foreground">Alerta de ejemplo: no se puede retirar ni marcar.</p>
  }

  const action: Action | null = alert.isMine ? 'withdraw' : alert.flaggedByMe ? null : 'flag'

  async function run(a: Action) {
    setBusy(true)
    try {
      await (a === 'flag' ? onFlag(alert.id) : onWithdraw(alert.id))
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  // Both views stay mounted and are toggled with `hidden`, so the clicked button is never
  // detached mid-event (detached targets also make Leaflet close the popup).
  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      {alert.isMine && <p className="text-xs text-muted-foreground">Este reporte lo hiciste vos.</p>}
      {alert.flaggedByMe && !alert.isMine && (
        <p className="text-xs text-muted-foreground">Ya indicaste que esta denuncia no es real.</p>
      )}

      {action && (
        <>
          <button
            type="button"
            hidden={confirming !== null}
            onClick={() => setConfirming(action)}
            className={
              action === 'withdraw'
                ? `${btn} self-start border-border text-foreground hover:border-destructive`
                : `${btn} self-start border-border text-muted-foreground hover:text-foreground`
            }
          >
            {action === 'withdraw' ? 'Retirar mi denuncia' : 'Esta denuncia no es real'}
          </button>

          <div hidden={confirming === null} className="flex flex-col gap-2 rounded-sm border border-border p-2">
            <p className="text-xs leading-relaxed">
              {action === 'withdraw'
                ? '¿Retirar tu reporte? Dejará de aparecer en el mapa y de afectar las rutas.'
                : '¿Confirmás que este incidente no es real o ya no aplica? Con varias marcas la alerta se descarta.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(action)}
                className={`${btn} border-destructive bg-destructive text-destructive-foreground`}
              >
                {busy ? 'Enviando…' : action === 'withdraw' ? 'Sí, retirar' : 'Sí, no es real'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(null)}
                className={`${btn} border-border`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
