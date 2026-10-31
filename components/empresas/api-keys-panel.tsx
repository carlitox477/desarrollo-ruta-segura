'use client'

import { Copy, KeyRound, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { createApiKey, revokeApiKey } from '@/app/actions/business'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_PLAN, estimateMonthlyCost, formatUsd } from '@/lib/business/plans'

export type ApiKeyRow = { id: number; name: string; prefix: string; lastUsedAt: string | null }

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

export function ApiKeysPanel({
  company,
  keys,
  monthlyCalls,
}: {
  company: string
  keys: ApiKeyRow[]
  monthlyCalls: number
}) {
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const atLimit = keys.length >= API_PLAN.maxActiveKeys

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{company}</p>
        <p className="text-sm text-muted-foreground">
          Este mes: <span className="font-mono text-foreground">{monthlyCalls.toLocaleString('es-AR')}</span>{' '}
          llamadas · estimado{' '}
          <span className="font-mono text-foreground">{formatUsd(estimateMonthlyCost(monthlyCalls))}</span>
        </p>
      </div>

      {newKey ? (
        <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">Copiá tu clave ahora. No la vamos a mostrar de nuevo.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">{newKey}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(newKey)
                setCopied(true)
              }}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          startTransition(async () => {
            const result = await createApiKey(name)
            if (result.ok) {
              setNewKey(result.key)
              setCopied(false)
              setName('')
              setMessage(null)
            } else {
              setMessage(result.message)
            }
          })
        }}
      >
        <Label htmlFor="key-name">Nueva API key</Label>
        <div className="flex gap-2">
          <Input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Producción"
            maxLength={60}
            disabled={atLimit}
          />
          <Button type="submit" disabled={pending || atLimit}>
            <KeyRound className="size-4" aria-hidden="true" />
            Crear
          </Button>
        </div>
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Claves activas ({keys.length}/{API_PLAN.maxActiveKeys})
        </p>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no creaste ninguna clave.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{key.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {key.prefix}… ·{' '}
                    {key.lastUsedAt ? `usada ${dateFormat.format(new Date(key.lastUsedAt))}` : 'sin uso'}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Revocar ${key.name}`}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`¿Revocar "${key.name}"? Las integraciones que la usen dejarán de funcionar.`)) return
                    startTransition(() => revokeApiKey(key.id))
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
