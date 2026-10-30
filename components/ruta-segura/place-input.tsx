'use client'

import { MapPin, Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { searchPlaces, type Place } from './client'

type Props = {
  marker: 'A' | 'B'
  label: string
  value: Place | null
  onChange: (p: Place | null) => void
  onPickOnMap: () => void
  picking: boolean
}

export function PlaceInput({ marker, label, value, onChange, onPickOnMap, picking }: Props) {
  const id = useId()
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 350)
    return () => clearTimeout(t)
  }, [text])

  const { data, isLoading, error } = useSWR(open && debounced.length >= 3 ? ['geo', debounced] : null, ([, q]) =>
    searchPlaces(q),
  )

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-secondary px-2',
          picking ? 'border-primary' : 'border-border',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            marker === 'A' ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground',
          )}
        >
          {marker}
        </span>
        {value ? (
          <>
            <span className="flex-1 truncate py-2 text-sm">{value.label}</span>
            <button
              type="button"
              aria-label={`Quitar ${label.toLowerCase()}`}
              onClick={() => onChange(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <Search aria-hidden className="size-4 text-muted-foreground" />
            <input
              id={id}
              value={text}
              autoComplete="off"
              placeholder="Buscar dirección en CABA"
              onChange={(e) => {
                setText(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </>
        )}
        <button
          type="button"
          onClick={onPickOnMap}
          aria-pressed={picking}
          aria-label={`Elegir ${label.toLowerCase()} en el mapa`}
          className={cn(
            'rounded-sm p-1',
            picking ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MapPin className="size-4" />
        </button>
      </div>
      {open && !value && debounced.length >= 3 && (
        <ul className="absolute top-full z-[1000] mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-sm">
          {isLoading && <li className="px-3 py-2 text-muted-foreground">Buscando…</li>}
          {error && <li className="px-3 py-2 text-destructive">Búsqueda no disponible. Elegí el punto en el mapa.</li>}
          {data?.length === 0 && <li className="px-3 py-2 text-muted-foreground">Sin resultados dentro de CABA.</li>}
          {data?.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p)
                  setText('')
                  setOpen(false)
                }}
                className="w-full px-3 py-2 text-left hover:bg-secondary"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
