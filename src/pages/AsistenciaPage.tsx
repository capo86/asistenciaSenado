import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Clock3,
  Loader2,
  LocateFixed,
  MapPin,
  Moon,
  Navigation,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useThemeMode } from '@/hooks/useThemeMode'
import { registrarAsistencia } from '@/lib/asistenciasApi'
import {
  formatDateRange,
  getEventoAvailability,
} from '@/lib/eventoAvailability'
import {
  obtenerEventoActualPublico,
  obtenerEventoPublico,
} from '@/lib/eventosApi'
import { haversineDistanceMeters } from '@/lib/geo'
import { buscarPersonaPorCedula } from '@/lib/personasApi'
import { isDataServiceConfigured } from '@/lib/supabaseClient'
import { usePanelStore } from '@/stores/panelStore'
import type { Evento } from '@/types/evento'

type AsistenciaPageProps = {
  eventoId?: string
}

type ResultState =
  | { kind: 'idle' }
  | { kind: 'success'; title: string; message: string }
  | { kind: 'warning'; title: string; message: string }
  | { kind: 'error'; title: string; message: string }

type LookupState =
  | { kind: 'idle' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

function normalizeCedula(value: string) {
  return value.replace(/\D/g, '')
}

export function AsistenciaPage({ eventoId }: AsistenciaPageProps) {
  const [cedula, setCedula] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' })
  const [isNombreLocked, setIsNombreLocked] = useState(false)
  const [isLookupLoading, setIsLookupLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isRemoteEventoLoading, setIsRemoteEventoLoading] = useState(false)
  const [remoteEvento, setRemoteEvento] = useState<Evento | null>(null)
  const [remoteEventoError, setRemoteEventoError] = useState<string | null>(null)
  const { error, position, requestLocation, status } = useGeolocation()
  const { theme, toggleTheme } = useThemeMode()
  const eventos = usePanelStore((state) => state.eventos)
  const eventoIdFromQuery = useMemo(
    () =>
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('evento'),
    [],
  )
  const requestedEventoId = eventoId ?? eventoIdFromQuery

  const localEvento = useMemo(
    () => {
      const requestedEvento =
        requestedEventoId === null || requestedEventoId === undefined
          ? undefined
          : eventos.find((item) => item.id === requestedEventoId)

      if (requestedEventoId) {
        return requestedEvento ?? null
      }

      return (
        eventos.find((item) => getEventoAvailability(item).isActiveToday) ??
        eventos.find((item) => item.estado === 'activo') ??
        eventos[0] ??
        null
      )
    },
    [eventos, requestedEventoId],
  )
  const evento = isDataServiceConfigured ? remoteEvento : localEvento
  const availability = useMemo(
    () => (evento ? getEventoAvailability(evento) : null),
    [evento],
  )

  useEffect(() => {
    if (!isDataServiceConfigured) {
      return
    }

    let isMounted = true

    async function loadEvento() {
      setIsRemoteEventoLoading(true)
      setRemoteEventoError(null)

      try {
        const row = requestedEventoId
          ? await obtenerEventoPublico(requestedEventoId)
          : await obtenerEventoActualPublico()

        if (!isMounted) {
          return
        }

        setRemoteEvento(row)
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        setRemoteEvento(null)
        setRemoteEventoError(
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo cargar el evento.',
        )
      } finally {
        if (isMounted) {
          setIsRemoteEventoLoading(false)
        }
      }
    }

    void loadEvento()

    return () => {
      isMounted = false
    }
  }, [requestedEventoId])

  const distance = useMemo(() => {
    if (!position || !evento) {
      return null
    }

    return haversineDistanceMeters(position, evento)
  }, [evento, position])

  const isInsideRadius =
    distance !== null && evento !== null && distance <= evento.radio_metros

  if (isRemoteEventoLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,var(--institutional-panel)_0%,var(--background)_46%)]" />
        <section className="relative mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="size-5 animate-spin text-[var(--institutional-gold)]" />
                Cargando evento
              </CardTitle>
              <CardDescription>
                Estamos preparando los datos de la actividad.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    )
  }

  if (!evento || !availability) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,var(--institutional-panel)_0%,var(--background)_46%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
          <header className="flex items-center justify-between gap-4 border bg-card/78 px-4 py-4 shadow-sm backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-white">
                <img
                  src={academiaLogo}
                  alt="Academia Legislativa Instituto Superior"
                  className="h-10 w-10 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  Academia Legislativa
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Instituto Superior
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
              }
              title={
                theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
              }
              className="shrink-0"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </header>

          <section className="flex flex-1 items-center justify-center py-10">
            <Card className="w-full max-w-xl">
              <CardHeader>
                <CardTitle>Evento no encontrado</CardTitle>
                <CardDescription>
                  {remoteEventoError ?? 'No hay un evento cargado para este enlace.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <CalendarDays />
                  <AlertTitle>Revisa el enlace del evento</AlertTitle>
                  <AlertDescription>
                    {requestedEventoId
                      ? `ID solicitado: ${requestedEventoId}`
                      : 'Todavia no hay eventos disponibles para mostrar.'}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    )
  }

  const activeEvento = evento
  const activeAvailability = availability
  const activeDescription =
    activeEvento.descripcion?.trim() ||
    'Registro institucional para participantes ubicados dentro del radio autorizado del evento.'

  function handleCedulaChange(value: string) {
    setCedula(value)
    setLookup({ kind: 'idle' })
    setIsNombreLocked(false)
  }

  async function handleBuscarPersona() {
    const cleanCedula = normalizeCedula(cedula)

    if (!activeAvailability.isActiveToday) {
      setResult({
        kind: 'error',
        title: 'Evento no disponible hoy',
        message: activeAvailability.message,
      })
      return
    }

    if (cleanCedula.length < 5) {
      setLookup({
        kind: 'error',
        message: 'Ingresa una cédula válida antes de buscar.',
      })
      return
    }

    setIsLookupLoading(true)
    setLookup({ kind: 'idle' })
    setIsNombreLocked(false)

    try {
      const persona = await buscarPersonaPorCedula(cleanCedula)

      setCedula(persona.cedula)
      setNombreCompleto(persona.nombre_completo)
      setLookup({ kind: 'success' })
      setIsNombreLocked(true)
    } catch (caughtError) {
      setLookup({
        kind: 'error',
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo consultar la cédula.',
      })
    } finally {
      setIsLookupLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanCedula = normalizeCedula(cedula)

    if (cleanCedula.length < 5) {
      setResult({
        kind: 'error',
        title: 'Cédula incompleta',
        message: 'Ingresa al menos 5 dígitos para continuar.',
      })
      return
    }

    if (!isDataServiceConfigured) {
      setResult({
        kind: 'error',
        title: 'Servicio no disponible',
        message: 'No se pudo registrar la asistencia en este momento.',
      })
      return
    }

    setIsRegistering(true)

    try {
      const currentPosition = await requestLocation()
      const meters = haversineDistanceMeters(currentPosition, activeEvento)
      const participantName = nombreCompleto.trim()

      if (meters > activeEvento.radio_metros) {
        setResult({
          kind: 'warning',
          title: 'No se encuentra en el local',
          message: 'Para registrar asistencia debes estar en el local del evento.',
        })
        return
      }

      await registrarAsistencia({
        cedula: cleanCedula,
        evento_id: activeEvento.id,
        latitud: currentPosition.latitud,
        longitud: currentPosition.longitud,
        nombre_completo: participantName || null,
      })

      toast.success('Asistencia registrada', {
        description: participantName
          ? `${participantName} quedó registrado correctamente.`
          : 'El registro fue guardado correctamente.',
      })
      setResult({
        kind: 'success',
        title: 'Asistencia registrada',
        message: participantName
          ? `${participantName}, tu asistencia fue registrada correctamente.`
          : 'Tu asistencia fue registrada correctamente.',
      })
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Intenta nuevamente.'

      toast.error('No se pudo registrar', {
        description: message,
      })
      setResult({
        kind: 'error',
        title: 'No se pudo registrar',
        message,
      })
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,var(--institutional-panel)_0%,var(--background)_46%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:52px_52px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card/78 px-4 py-4 shadow-sm backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-white">
              <img
                src={academiaLogo}
                alt="Academia Legislativa Instituto Superior"
                className="h-10 w-10 object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                Academia Legislativa
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Instituto Superior
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
            }
            title={
              theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
            }
            className="shrink-0"
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </header>

        <section className="grid flex-1 grid-cols-1 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="contents lg:relative lg:flex lg:min-h-[35rem] lg:flex-col lg:justify-start lg:overflow-hidden lg:border-r lg:px-8 lg:py-10">
            <img
              src={senateSeal}
              alt=""
              className="pointer-events-none absolute right-[-5rem] bottom-[-4rem] hidden h-72 w-72 object-contain opacity-[var(--institutional-watermark-opacity)] lg:block"
            />

            <div className="relative order-1 px-4 pt-8 pb-4 sm:px-6 lg:px-0 lg:py-0">
              <Badge
                className={
                  activeAvailability.isActiveToday
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground'
                }
              >
                <ShieldCheck />
                {activeAvailability.label}
              </Badge>

              <div className="mt-8 max-w-xl">
                <p className="mb-3 text-sm font-medium text-[var(--institutional-gold)]">
                  Poder Legislativo · Cámara de Senadores
                </p>
                <h1 className="max-w-xl break-words text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                  {activeEvento.nombre}
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                  {activeDescription}
                </p>
              </div>
            </div>

            <div className="relative order-3 grid gap-4 border-t px-4 py-6 sm:grid-cols-2 sm:px-6 lg:mt-10 lg:border-t-0 lg:px-0 lg:py-0">
                <div className="border-l border-[var(--institutional-line)] pl-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="size-4 text-[var(--institutional-gold)]" />
                    Lugar
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {activeEvento.lugar}
                  </p>
                </div>
                <div className="border-l border-[var(--institutional-line)] pl-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 text-[var(--institutional-gold)]" />
                    Radio
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {activeEvento.radio_metros} metros
                  </p>
                </div>
                <div className="border-l border-border pl-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" />
                    Fecha
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {formatDateRange(
                      activeEvento.fecha_desde,
                      activeEvento.fecha_hasta,
                    )}
                  </p>
                </div>
                <div className="border-l border-border pl-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4" />
                    Horario
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {activeEvento.hora_inicio ?? '--:--'} a{' '}
                    {activeEvento.hora_fin ?? '--:--'}
                  </p>
                </div>
              </div>
          </aside>

          <section className="order-2 flex items-center justify-center px-4 pt-2 pb-8 sm:px-6 lg:order-none lg:px-10 lg:py-8">
            <Card className="w-full max-w-xl border-border bg-card/95 shadow-xl shadow-black/5 dark:shadow-black/30">
              <CardHeader>
                <CardTitle className="text-xl">Registrar asistencia</CardTitle>
                <CardDescription>
                  {activeDescription}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="cedula">Número de cédula</Label>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="cedula"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="Ej. 1234567"
                          value={cedula}
                          onChange={(event) =>
                            handleCedulaChange(event.target.value)
                          }
                          className="h-12 pl-10 text-base"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 sm:min-w-28"
                        onClick={handleBuscarPersona}
                        disabled={isLookupLoading || !isDataServiceConfigured}
                      >
                        {isLookupLoading ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Search />
                        )}
                        {isLookupLoading ? 'Buscando' : 'Buscar'}
                      </Button>
                    </div>
                    {lookup.kind === 'error' ? (
                      <p
                        className="text-sm text-destructive"
                      >
                        {lookup.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre completo</Label>
                    <Input
                      id="nombre"
                      autoComplete="name"
                      placeholder="Opcional"
                      value={nombreCompleto}
                      onChange={(event) => setNombreCompleto(event.target.value)}
                      disabled={isNombreLocked}
                      className="h-12 text-base disabled:pointer-events-none disabled:bg-muted/65 disabled:text-foreground disabled:opacity-100"
                    />
                  </div>

                  <div className="grid gap-3 rounded-md border bg-muted/45 p-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Ubicacion</p>
                      <p className="mt-1 font-medium">
                        {position
                          ? isInsideRadius
                            ? 'Dentro del local'
                            : 'No se encuentra en el local'
                          : 'Pendiente'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Evento</p>
                      <p className="mt-1 font-medium">
                        {activeAvailability.label}
                      </p>
                    </div>
                  </div>

                  {!activeAvailability.isActiveToday ? (
                    <Alert variant="destructive">
                      <CalendarDays />
                      <AlertTitle>Evento no disponible hoy</AlertTitle>
                      <AlertDescription>
                        {activeAvailability.message} Fecha de hoy:{' '}
                        {activeAvailability.today}.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {status === 'error' ? (
                    <Alert variant="destructive">
                      <MapPin />
                      <AlertTitle>Ubicación no disponible</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  {result.kind !== 'idle' ? (
                    <Alert
                      variant={
                        result.kind === 'error' ? 'destructive' : 'default'
                      }
                      className={
                        result.kind === 'success'
                          ? 'border-emerald-600/25 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                          : result.kind === 'warning'
                            ? 'border-[var(--institutional-line)] bg-primary/10 text-foreground'
                            : undefined
                      }
                    >
                      {result.kind === 'success' ? (
                        <BadgeCheck />
                      ) : result.kind === 'warning' ? (
                        <Navigation />
                      ) : (
                        <MapPin />
                      )}
                      <AlertTitle>{result.title}</AlertTitle>
                      <AlertDescription>
                        {result.message}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    type="submit"
                    className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
                    disabled={
                      status === 'loading' ||
                      isRegistering ||
                      !activeAvailability.isActiveToday
                    }
                  >
                    {status === 'loading' || isRegistering ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <LocateFixed />
                    )}
                    {isRegistering
                      ? 'Registrando'
                      : status === 'loading'
                      ? 'Validando ubicación'
                      : 'Registrar Asistencia'}
                  </Button>
                </form>
              </CardContent>

              <Separator />

              <CardFooter className="justify-between gap-4 bg-muted/35 text-xs text-muted-foreground">
                <span>
                {position
                  ? isInsideRadius
                    ? 'Dentro del local'
                    : 'No se encuentra en el local'
                  : activeAvailability.isActiveToday
                    ? 'Ubicacion pendiente de validar'
                    : 'Evento fuera de fecha para registrar'}
                </span>
                <span>Alta precisión activa</span>
              </CardFooter>
            </Card>
          </section>
        </section>
      </div>
    </main>
  )
}
