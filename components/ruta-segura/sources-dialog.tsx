'use client'

import useSWR from 'swr'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { OpenArgStatus } from '@/lib/openarg'
import { SCORING_CONFIG } from '@/lib/routing/scoring'

const fetcher = (u: string) => fetch(u).then((r) => r.json() as Promise<OpenArgStatus>)

export function SourcesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = useSWR(open ? '/api/openarg' : null, fetcher, { revalidateOnFocus: false })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cómo se calcula la ruta</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Prototipo de hackathon. Ninguna ruta es 100% segura; esto es información de apoyo, no una garantía.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h3 className="font-semibold">Modelo de costo</h3>
          <p className="rounded-md bg-secondary p-3 font-mono text-xs">
            costo = tiempo_base + Σ penalización_alerta + penalización_datos_oficiales
          </p>
          <p className="text-muted-foreground">
            Cada alerta activa a menos de {SCORING_CONFIG.influenceRadiusMeters} m de la ruta suma hasta{' '}
            {SCORING_CONFIG.penaltySecondsFull / 60} min, ponderado por severidad, antigüedad (decae a la mitad según la
            categoría), confianza (confirmaciones suman, marcas restan) y cercanía. La penalización total se limita al{' '}
            {SCORING_CONFIG.maxPenaltyRatio * 100}% del tiempo base y se descartan desvíos más de{' '}
            {Math.round((SCORING_CONFIG.maxDetourRatio - 1) * 100)}% más largos que la ruta más rápida.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h3 className="font-semibold">Fuentes</h3>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>Calles y ruteo: OpenStreetMap vía OSRM (routing.openstreetmap.de / project-osrm.org).</li>
            <li>Direcciones: Nominatim (OpenStreetMap).</li>
            <li>Alertas: reportes comunitarios anónimos guardados en Postgres (Neon). Las marcadas DEMO son sintéticas.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h3 className="font-semibold">Datos oficiales (OpenArg)</h3>
          {isLoading && <p className="text-muted-foreground">Consultando catálogo…</p>}
          {data && !data.configured && <p className="text-muted-foreground">{data.note}</p>}
          {data?.configured && (
            <>
              {data.ok ? (
                <p className="font-mono text-xs text-muted-foreground">
                  Consultado {new Date(data.queriedAt).toLocaleString('es-AR')} · búsquedas: {data.queries.join(' / ')}
                </p>
              ) : (
                <p className="text-destructive">No se pudo consultar OpenArg: {data.error}</p>
              )}
              {data.datasets.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {data.datasets.map((d) => (
                    <li key={d.title + d.portal} className="rounded-md border border-border p-2">
                      <p className="font-medium">{d.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {d.portal ?? 'portal desconocido'}
                        {d.url && (
                          <>
                            {' · '}
                            <a href={d.url} target="_blank" rel="noreferrer" className="underline">
                              fuente
                            </a>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground">{data.note}</p>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed">
          <h3 className="font-semibold">Límites conocidos</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
            <li>Pocas alertas no significa que una zona sea segura: puede faltar información.</li>
            <li>Los reportes no se verifican; se mitiga con límites por dispositivo, duplicados y marcas comunitarias.</li>
            <li>Los tiempos de los servicios públicos de ruteo son estimados.</li>
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  )
}
