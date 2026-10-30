'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ABUSE_LIMITS, CATEGORIES, CATEGORY_CONFIG, SEVERITY_LABELS } from '@/lib/alerts/config'
import type { AlertCategory, LatLng } from '@/lib/types'
import { cn } from '@/lib/utils'
import { postAlert } from './client'

const WHEN = [
  { label: 'Ahora', minutes: 0 },
  { label: 'Hace 15 min', minutes: 15 },
  { label: 'Hace 1 h', minutes: 60 },
  { label: 'Hace 3 h', minutes: 180 },
]

type Props = { location: LatLng | null; onClose: () => void; onCreated: () => void }

export function ReportDialog({ location, onClose, onCreated }: Props) {
  const [category, setCategory] = useState<AlertCategory>('robo')
  const [severity, setSeverity] = useState(CATEGORY_CONFIG.robo.defaultSeverity)
  const [when, setWhen] = useState(0)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!location) return
    setSubmitting(true)
    try {
      const res = await postAlert({
        category,
        severity,
        lat: location.lat,
        lng: location.lng,
        description: description.trim() || undefined,
        occurredAt: new Date(Date.now() - when * 60_000).toISOString(),
      })
      toast.success(
        res.duplicateOf
          ? 'Ya había una alerta similar cerca: sumamos tu confirmación.'
          : 'Alerta publicada. Las rutas se recalculan con este dato.',
      )
      setDescription('')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el reporte.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!location} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Reportar incidente</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Anónimo. No incluyas nombres, descripciones físicas, patentes ni datos personales. Si estás en peligro,
              llamá al 911.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Tipo</legend>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c}
                  className={cn(
                    'cursor-pointer rounded-md border px-3 py-2 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    category === c ? 'border-primary bg-secondary' : 'border-border',
                  )}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={category === c}
                    onChange={() => {
                      setCategory(c)
                      setSeverity(CATEGORY_CONFIG[c].defaultSeverity)
                    }}
                    className="sr-only"
                  />
                  {CATEGORY_CONFIG[c].label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Severidad <span className="text-muted-foreground">· {SEVERITY_LABELS[severity]}</span>
            </legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <label
                  key={s}
                  className={cn(
                    'flex flex-1 cursor-pointer justify-center rounded-md border py-2 font-mono text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    severity === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  <input type="radio" name="severity" checked={severity === s} onChange={() => setSeverity(s)} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Cuándo ocurrió</legend>
            <div className="flex flex-wrap gap-2">
              {WHEN.map((w) => (
                <label
                  key={w.minutes}
                  className={cn(
                    'cursor-pointer rounded-md border px-3 py-1.5 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    when === w.minutes ? 'border-primary bg-secondary' : 'border-border',
                  )}
                >
                  <input type="radio" name="when" checked={when === w.minutes} onChange={() => setWhen(w.minutes)} className="sr-only" />
                  {w.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="desc">Descripción breve (opcional)</Label>
            <Textarea
              id="desc"
              value={description}
              maxLength={ABUSE_LIMITS.descriptionMaxLength}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej.: esquina sin luz, varias personas merodeando"
              rows={3}
            />
            <span className="self-end font-mono text-xs text-muted-foreground">
              {description.length}/{ABUSE_LIMITS.descriptionMaxLength}
            </span>
          </div>

          {location && (
            <p className="font-mono text-xs text-muted-foreground">
              Ubicación: {location.lat.toFixed(5)}, {location.lng.toFixed(5)} · vence en{' '}
              {CATEGORY_CONFIG[category].ttlHours >= 48
                ? `${Math.round(CATEGORY_CONFIG[category].ttlHours / 24)} días`
                : `${CATEGORY_CONFIG[category].ttlHours} h`}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Publicar alerta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
