import { type FormEvent, useState } from 'react'
import {
  ArrowLeft,
  Loader2,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react'

import academiaLogo from '../../nuevo_Mesa de trabajo 1.png'
import senateSeal from '../../unnamed.png'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useThemeMode } from '@/hooks/useThemeMode'
import { isDataServiceConfigured } from '@/lib/supabaseClient'
import { useSessionStore } from '@/stores/sessionStore'

export function PanelLoginPage() {
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const signInWithCedula = useSessionStore((state) => state.signInWithCedula)
  const { theme, toggleTheme } = useThemeMode()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await signInWithCedula(cedula, password)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo ingresar al panel.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,var(--institutional-panel)_0%,var(--background)_48%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex min-h-[28rem] flex-col justify-between overflow-hidden border-b px-5 py-6 sm:px-8 lg:border-r lg:border-b-0 lg:px-10 lg:py-9">
          <img
            src={senateSeal}
            alt=""
            className="pointer-events-none absolute right-[-5rem] bottom-[-4rem] h-72 w-72 object-contain opacity-[var(--institutional-watermark-opacity)]"
          />

          <div className="relative flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-white">
              <img
                src={academiaLogo}
                alt="Academia Legislativa Instituto Superior"
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold">Academia Legislativa</p>
              <p className="text-xs text-muted-foreground">
                Instituto Superior
              </p>
            </div>
          </div>

          <div className="relative my-10 max-w-xl">
            <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
              <ShieldCheck />
              Acceso restringido
            </Badge>
            <h1 className="mt-6 max-w-lg text-4xl font-semibold leading-tight">
              Panel operativo
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Ingresa con tu cedula y contrasena para cargar eventos y revisar
              asistencias registradas.
            </p>
          </div>

          <div className="relative border-t pt-5">
            <p className="text-sm text-muted-foreground">
              El acceso se valida con usuarios autorizados.
            </p>
          </div>
        </aside>

        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <Card className="w-full max-w-md border-border bg-card/95 shadow-xl shadow-black/5 dark:shadow-black/30">
            <CardHeader>
              <div className="mb-3 flex items-center justify-between gap-3">
                <Button asChild variant="outline" size="icon" title="Volver">
                  <a href="/">
                    <ArrowLeft />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={
                    theme === 'dark'
                      ? 'Activar modo claro'
                      : 'Activar modo oscuro'
                  }
                  title={
                    theme === 'dark'
                      ? 'Activar modo claro'
                      : 'Activar modo oscuro'
                  }
                >
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
              </div>
              <CardTitle className="text-xl">Ingresar al panel</CardTitle>
              <CardDescription>
                Usa la misma cedula registrada en usuarios.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="panel-cedula">Cedula</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="panel-cedula"
                      inputMode="numeric"
                      autoComplete="username"
                      placeholder="Ej. 1234567"
                      value={cedula}
                      onChange={(event) => setCedula(event.target.value)}
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-password">Contrasena</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="panel-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Tu contrasena"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                </div>

                {!isDataServiceConfigured ? (
                  <Alert variant="destructive">
                    <LockKeyhole />
                    <AlertTitle>Servicio no disponible</AlertTitle>
                    <AlertDescription>
                      Revisa la configuracion del entorno.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {error ? (
                  <Alert variant="destructive">
                    <LockKeyhole />
                    <AlertTitle>No se pudo ingresar</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
                  disabled={isSubmitting || !isDataServiceConfigured}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ShieldCheck />
                  )}
                  {isSubmitting ? 'Verificando' : 'Ingresar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
