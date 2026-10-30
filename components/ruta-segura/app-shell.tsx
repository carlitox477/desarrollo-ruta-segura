'use client'

import { Crosshair, Footprints, Car, Info, LocateFixed, RefreshCw, TriangleAlert, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { CATEGORY_CONFIG, isInsideCaba } from '@/lib/alerts/config'
import type { LatLng, Priority, ScoredRoute, TravelMode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DEMO_TRIP, flagAlert, fmtMin, getAlerts, postRoutes, sameRoute, type Place } from './client'
import { PlaceInput } from './place-input'
import { ReportDialog } from './report-dialog'
import { RouteList } from './route-list'
import { SourcesDialog } from './sources-dialog'

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Cargando mapa…</div>,
})

type PickMode = 'origin' | 'destination' | 'report' | null

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'tiempo', label: 'Tiempo' },
  { value: 'distancia', label: 'Distancia' },
]

const pointLabel = (p: LatLng) => `Punto ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`

function describeChange(prev: ScoredRoute, next: ScoredRoute, prevNow: ScoredRoute | undefined) {
  if (prevNow) {
    const added = prevNow.impacts.find((i) => !prev.impacts.some((p) => p.alertId === i.alertId))
    if (added) {
      return `La ruta anterior ahora pasa a ${added.distanceMeters} m de una alerta de ${CATEGORY_CONFIG[added.category].label.toLowerCase()} (severidad ${added.severity}): su costo subió a ${fmtMin(prevNow.cost)}. La nueva recomendada cuesta ${fmtMin(next.cost)}.`
    }
  }
  const removed = prev.impacts.find((i) => !next.impacts.some((n) => n.alertId === i.alertId))
  if (removed && sameRoute(next, next)) {
    return `Una alerta de ${CATEGORY_CONFIG[removed.category].label.toLowerCase()} venció o fue descartada, y cambió la ruta más conveniente.`
  }
  return 'Las alertas cambiaron y se eligió una ruta con menor costo total.'
}

export function AppShell() {
  const [origin, setOrigin] = useState<Place | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [priority, setPriority] = useState<Priority>('seguridad')
  const [mode, setMode] = useState<TravelMode>('foot')
  const [pick, setPick] = useState<PickMode>(null)
  const [reportAt, setReportAt] = useState<LatLng | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [change, setChange] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const { data: alertsData, error: alertsError, mutate: mutateAlerts } = useSWR('/api/alerts', getAlerts, {
    refreshInterval: 20_000,
  })
  const alerts = alertsData?.alerts ?? []
  const alertsSig = alerts.map((a) => `${a.id}:${a.flagCount}:${a.confirmCount}`).join('|')

  const tripKey =
    origin && destination
      ? JSON.stringify({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          priority,
          mode,
        })
      : null

  const {
    data: routesData,
    error: routesError,
    isValidating,
    mutate: mutateRoutes,
  } = useSWR(tripKey && (alertsData || alertsError) ? ['routes', tripKey, alertsSig] : null, ([, key]) => postRoutes(key), {
    keepPreviousData: true,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
  const routes = routesData && routesData.tripKey === tripKey ? routesData.routes : []

  const prevRef = useRef<{ tripKey: string; route: ScoredRoute } | null>(null)
  useEffect(() => {
    if (!routesData) return
    const rec = routesData.routes[0]
    const prev = prevRef.current
    if (prev && rec && prev.tripKey === routesData.tripKey && !sameRoute(prev.route, rec)) {
      setChange(describeChange(prev.route, rec, routesData.routes.find((r) => sameRoute(r, prev.route))))
      setSelectedId(null)
    }
    if (prev?.tripKey !== routesData.tripKey) {
      setChange(null)
      setSelectedId(null)
    }
    prevRef.current = rec ? { tripKey: routesData.tripKey, route: rec } : null
  }, [routesData])

  function handleMapClick(p: LatLng) {
    if (!pick) return
    if (!isInsideCaba(p.lat, p.lng)) {
      toast.error('Elegí un punto dentro de la Ciudad de Buenos Aires.')
      return
    }
    if (pick === 'origin') setOrigin({ ...p, label: pointLabel(p) })
    if (pick === 'destination') setDestination({ ...p, label: pointLabel(p) })
    if (pick === 'report') setReportAt(p)
    setPick(pick === 'origin' && !destination ? 'destination' : null)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error('Tu navegador no permite geolocalización.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (!isInsideCaba(p.lat, p.lng)) return toast.error('Tu ubicación está fuera de CABA.')
        setOrigin({ ...p, label: 'Mi ubicación' })
      },
      () => toast.error('No se pudo obtener tu ubicación.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  async function handleFlag(id: number) {
    try {
      const res = await flagAlert(id)
      toast.success(res.alert.status === 'dismissed' ? 'Alerta descartada por la comunidad.' : 'Gracias, registramos tu marca.')
      mutateAlerts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo marcar la alerta.')
    }
  }

  const pickHint =
    pick === 'origin'
      ? 'Tocá el mapa para elegir el origen'
      : pick === 'destination'
        ? 'Tocá el mapa para elegir el destino'
        : pick === 'report'
          ? 'Tocá el mapa donde ocurrió el incidente'
          : null

  return (
    <div className={cn('flex h-dvh flex-col-reverse md:flex-row', pick && 'picking')}>
      <aside className="flex max-h-[58dvh] shrink-0 flex-col gap-5 overflow-y-auto border-t border-border bg-background p-4 md:max-h-none md:w-[400px] md:border-t-0 md:border-r md:p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">
              Ruta Segura <span className="font-mono text-sm font-normal text-primary">CABA</span>
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Rutas que evitan zonas con alertas recientes de la comunidad.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cómo funciona y fuentes" onClick={() => setSourcesOpen(true)}>
            <Info />
          </Button>
        </header>

        <section className="flex flex-col gap-3" aria-label="Viaje">
          <PlaceInput
            marker="A"
            label="Origen"
            value={origin}
            onChange={setOrigin}
            picking={pick === 'origin'}
            onPickOnMap={() => setPick(pick === 'origin' ? null : 'origin')}
          />
          <PlaceInput
            marker="B"
            label="Destino"
            value={destination}
            onChange={setDestination}
            picking={pick === 'destination'}
            onPickOnMap={() => setPick(pick === 'destination' ? null : 'destination')}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={useMyLocation}>
              <LocateFixed /> Mi ubicación
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOrigin(DEMO_TRIP.origin)
                setDestination(DEMO_TRIP.destination)
                setPriority('seguridad')
              }}
            >
              Cargar viaje de ejemplo
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Prioridad" className="grid grid-cols-3 rounded-md bg-secondary p-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={priority === p.value}
                onClick={() => setPriority(p.value)}
                className={cn(
                  'rounded-sm py-1.5 text-sm',
                  priority === p.value ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Medio" className="flex gap-2">
            {(
              [
                { value: 'foot', label: 'A pie', Icon: Footprints },
                { value: 'car', label: 'Auto', Icon: Car },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md border py-1.5 text-sm',
                  mode === value ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </section>

        {change && (
          <div role="status" className="flex gap-3 rounded-md border border-primary bg-card p-3 text-sm leading-relaxed">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="flex-1 text-pretty">
              <span className="font-semibold">Ruta recomendada actualizada.</span> {change}
            </p>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setChange(null)} className="self-start text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
        )}

        <section className="flex flex-col gap-3" aria-live="polite">
          {!tripKey && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Elegí origen y destino (buscando o tocando el mapa) para ver las rutas candidatas.
            </p>
          )}
          {tripKey && routesError && <p className="text-sm text-destructive">{routesError.message}</p>}
          {tripKey && !routesError && routes.length === 0 && <p className="text-sm text-muted-foreground">Calculando rutas…</p>}
          {routes.length > 0 && (
            <>
              <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                <span>
                  {routes.length} rutas · {routesData?.alertsConsidered ?? 0} alertas activas
                </span>
                <span>{isValidating ? 'recalculando…' : `calc. ${new Date(routesData!.computedAt).toLocaleTimeString('es-AR')}`}</span>
              </div>
              {routesData?.warnings.map((w) => (
                <p key={w} className="text-sm text-destructive">
                  {w}
                </p>
              ))}
              <RouteList routes={routes} selectedId={selectedId} onSelect={setSelectedId} />
              <Button variant="ghost" size="sm" className="self-start" onClick={() => mutateRoutes()}>
                <RefreshCw /> Recalcular ahora
              </Button>
            </>
          )}
          {alertsError && <p className="text-sm text-destructive">No se pudieron cargar las alertas.</p>}
        </section>

        <footer className="mt-auto border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          Información de apoyo, no una garantía de seguridad. Pocas alertas no implica que una zona sea segura. Emergencias: 911.
        </footer>
      </aside>

      <main className="relative min-h-0 flex-1">
        <MapView
          alerts={alerts}
          routes={routes}
          selectedId={selectedId}
          origin={origin}
          destination={destination}
          draft={reportAt}
          onMapClick={handleMapClick}
          onSelectRoute={setSelectedId}
          onFlag={handleFlag}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col items-center gap-2 p-3">
          {pickHint && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              <Crosshair className="size-4" aria-hidden /> {pickHint}
              <button type="button" aria-label="Cancelar" onClick={() => setPick(null)}>
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
        <div className="absolute right-3 bottom-6 z-[500]">
          <Button
            size="lg"
            variant="destructive"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => setPick('report')}
          >
            <TriangleAlert /> Reportar incidente
          </Button>
        </div>
      </main>

      <ReportDialog
        location={reportAt}
        onClose={() => setReportAt(null)}
        onCreated={() => {
          setReportAt(null)
          mutateAlerts()
        }}
      />
      <SourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  )
}
