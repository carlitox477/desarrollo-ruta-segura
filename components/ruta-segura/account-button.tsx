'use client'

import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { signIn, signOut, useSession } from '@/lib/auth-client'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  )
}

export function AccountButton({ googleEnabled }: { googleEnabled: boolean }) {
  const { data: session, isPending } = useSession()
  const [busy, setBusy] = useState(false)

  if (isPending) {
    return <div className="h-9 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />
  }

  if (session?.user) {
    const { name, email, image } = session.user
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-2 pl-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {(name || email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{name || email}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar sesión"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await signOut()
            setBusy(false)
            toast.success('Sesión cerrada')
          }}
        >
          <LogOut />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="outline"
        className="w-full"
        disabled={!googleEnabled || busy}
        onClick={async () => {
          setBusy(true)
          const { error } = await signIn.social({ provider: 'google', callbackURL: '/' })
          if (error) {
            console.error('Google sign-in failed:', error)
            toast.error('No se pudo iniciar sesión con Google. Probá de nuevo.')
            setBusy(false)
          }
        }}
      >
        <GoogleMark />
        Ingresar con Google
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {googleEnabled
          ? 'Opcional: tus reportes quedan asociados a tu cuenta en cualquier dispositivo.'
          : 'El ingreso con Google se habilita cuando se configuran las credenciales.'}
      </p>
    </div>
  )
}
