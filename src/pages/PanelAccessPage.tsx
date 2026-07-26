import { Loader2 } from 'lucide-react'

import { PanelLoginPage } from '@/pages/PanelLoginPage'
import { PanelPage } from '@/pages/PanelPage'
import { useSessionStore } from '@/stores/sessionStore'

export function PanelAccessPage() {
  const status = useSessionStore((state) => state.status)

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin" />
          Verificando sesion
        </div>
      </main>
    )
  }

  if (status === 'authenticated') {
    return <PanelPage />
  }

  return <PanelLoginPage />
}
