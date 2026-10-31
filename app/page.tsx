import { AppShell } from '@/components/ruta-segura/app-shell'
import { isGoogleLoginConfigured } from '@/lib/auth'

export default function Page() {
  return <AppShell googleEnabled={isGoogleLoginConfigured} />
}
