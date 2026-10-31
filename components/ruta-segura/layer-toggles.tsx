'use client'

import { Cctv, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

type Layer = { count?: number; on: boolean; set: (v: boolean) => void }

type Props = { comisarias: Layer; camaras: Layer; loading: boolean; error: boolean }

export function LayerToggles({ comisarias, camaras, loading, error }: Props) {
  const items = [
    { key: 'comisarias', label: 'Comisarías', Icon: Shield, layer: comisarias, hint: null },
    { key: 'camaras', label: 'Cámaras', Icon: Cctv, layer: camaras, hint: 'Visibles al acercar el mapa' },
  ]
  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5" role="group" aria-label="Capas del mapa">
      {items.map(({ key, label, Icon, layer, hint }) => (
        <button
          key={key}
          type="button"
          aria-pressed={layer.on}
          title={hint ?? undefined}
          onClick={() => layer.set(!layer.on)}
          className={cn(
            'flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs',
            layer.on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
          <span className="font-mono text-muted-foreground">{loading ? '…' : error ? '!' : (layer.count ?? 0)}</span>
        </button>
      ))}
      {error && <p className="rounded-md bg-background px-2 py-1 text-xs text-destructive">No se pudieron cargar las capas.</p>}
    </div>
  )
}
