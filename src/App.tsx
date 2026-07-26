import { useEffect } from 'react'
import { Route, Switch } from 'wouter'

import { Toaster } from '@/components/ui/sonner'
import { AsistenciaPage } from '@/pages/AsistenciaPage'
import { PanelAccessPage } from '@/pages/PanelAccessPage'
import { useSessionStore } from '@/stores/sessionStore'

function App() {
  const initialize = useSessionStore((state) => state.initialize)

  useEffect(() => initialize(), [initialize])

  return (
    <>
      <Switch>
        <Route path="/panel">
          <PanelAccessPage />
        </Route>
        <Route path="/evento/:eventoId">
          {(params) => <AsistenciaPage eventoId={params.eventoId} />}
        </Route>
        <Route>
          <AsistenciaPage />
        </Route>
      </Switch>
      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
