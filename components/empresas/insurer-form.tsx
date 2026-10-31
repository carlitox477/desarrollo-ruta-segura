'use client'

import { CheckCircle2 } from 'lucide-react'
import { useActionState } from 'react'
import { requestDatasetAccess, type DatasetRequestState } from '@/app/actions/business'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function InsurerForm({ defaultEmail, defaultName }: { defaultEmail: string; defaultName: string }) {
  const [state, formAction, pending] = useActionState<DatasetRequestState, FormData>(requestDatasetAccess, null)

  if (state?.ok) {
    return (
      <div className="flex h-full flex-col items-start gap-3 rounded-lg border border-border bg-card p-5" role="status">
        <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
        <p className="font-medium">Solicitud enviada</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{state.message}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">Solicitar acceso completo</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Histórico completo, actualización diaria y licencia de uso comercial. Te enviamos la propuesta por email.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="company">Aseguradora</Label>
        <Input id="company" name="company" required maxLength={120} autoComplete="organization" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contactName">Nombre de contacto</Label>
        <Input id="contactName" name="contactName" required maxLength={120} defaultValue={defaultName} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email laboral</Label>
        <Input id="email" name="email" type="email" required maxLength={160} defaultValue={defaultEmail} autoComplete="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="useCase">Uso previsto (opcional)</Label>
        <Textarea
          id="useCase"
          name="useCase"
          maxLength={600}
          rows={3}
          placeholder="Ej.: tarificación de pólizas de auto por zona y franja horaria"
        />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Enviando…' : 'Solicitar acceso'}
      </Button>
    </form>
  )
}
