import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { DatasetStats } from '@/lib/business/dataset'

const HOUR_LABELS = [0, 6, 12, 18, 23]

function formatSince(iso: string | null) {
  if (!iso) return 'sin datos aún'
  const label = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function DatasetPanel({ stats }: { stats: DatasetStats }) {
  const maxHour = Math.max(1, ...stats.byHour)
  const maxCategory = Math.max(1, ...stats.byCategory.map((c) => c.count))
  const resolved = stats.byStatus.withdrawn + stats.byStatus.dismissed

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-5">
      <dl className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Denuncias reales</dt>
          <dd className="font-mono text-2xl font-medium">{stats.total}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Retiradas o descartadas</dt>
          <dd className="font-mono text-2xl font-medium">{resolved}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Registro desde</dt>
          <dd className="text-sm font-medium leading-8">{formatSince(stats.firstReportAt)}</dd>
        </div>
      </dl>

      <figure className="flex flex-col gap-2">
        <figcaption className="text-xs text-muted-foreground">Denuncias por hora del día (hora de Buenos Aires)</figcaption>
        <div
          className="flex h-16 items-end gap-0.5"
          role="img"
          aria-label={`Distribución horaria: ${stats.byHour.map((n, h) => `${h} h: ${n}`).join(', ')}`}
        >
          {stats.byHour.map((count, hour) => (
            <div
              key={hour}
              className="flex-1 rounded-sm bg-primary"
              style={{
                height: `${Math.max(6, (count / maxHour) * 100)}%`,
                opacity: count === 0 ? 0.15 : 0.35 + (count / maxHour) * 0.65,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          {HOUR_LABELS.map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}h</span>
          ))}
        </div>
      </figure>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Por categoría</p>
        <ul className="flex flex-col gap-2">
          {stats.byCategory.map((c) => (
            <li key={c.category} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate">{c.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-foreground/70"
                  style={{ width: `${(c.count / maxCategory) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right font-mono text-muted-foreground">{c.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Muestra gratuita de hasta 200 filas en CSV, incluidas las alertas demo marcadas como tales.
        </p>
        <a href="/api/datasets/sample" download className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}>
          <Download aria-hidden="true" />
          Descargar muestra
        </a>
      </div>
    </div>
  )
}
