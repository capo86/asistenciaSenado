import {
  lazy,
  Suspense,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Download,
  FilePenLine,
  ImageIcon,
  ImageUp,
  Loader2,
  LayoutGrid,
  ListChecks,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Phone,
  QrCode,
  Save,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'

import academiaLogo from '../../nuevo_Mesa de trabajo 1.png'
import { EventQrCard } from '@/components/panel/EventQrCard'
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useThemeMode } from '@/hooks/useThemeMode'
import { listarAsistenciasPanel } from '@/lib/asistenciasApi'
import { cedulaFromAuthEmail } from '@/lib/authIdentity'
import {
  formatDateRange,
  getEventoAvailability,
} from '@/lib/eventoAvailability'
import {
  guardarEventoPanel,
  listarEventosPanel,
  subirFlyerEvento,
} from '@/lib/eventosApi'
import { isDataServiceConfigured } from '@/lib/supabaseClient'
import {
  eventoEstados,
  usePanelStore,
} from '@/stores/panelStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { Asistencia } from '@/types/asistencia'
import type { Evento, EventoEstado } from '@/types/evento'

const EventLocationMap = lazy(() =>
  import('@/components/panel/EventLocationMap').then((module) => ({
    default: module.EventLocationMap,
  })),
)

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function parseDateOnlyUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return Date.UTC(year, month - 1, day)
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function getEventoDayLabel(evento: Evento, asistencia: Asistencia) {
  const startDate = parseDateOnlyUtc(evento.fecha_desde)
  const asistenciaDate = parseDateOnlyUtc(asistencia.fecha_local)
  const dayNumber =
    Math.floor((asistenciaDate - startDate) / 86_400_000) + 1

  if (!Number.isFinite(dayNumber) || dayNumber < 1) {
    return 'Fuera de rango'
  }

  return `Dia ${dayNumber}`
}

function formatMeters(value: number | null) {
  if (value === null) {
    return 'Sin dato'
  }

  return `${Math.round(value)} m`
}

function getAttendanceStats(eventoId: string, asistencias: Asistencia[]) {
  const rows = asistencias.filter((row) => row.evento_id === eventoId)
  const dentro = rows.filter((row) => row.dentro_del_cuadrante).length

  return {
    dentro,
    fuera: rows.length - dentro,
    rows,
    total: rows.length,
  }
}

function getAvailabilityBadgeClass(evento: Evento) {
  return getEventoAvailability(evento).isActiveToday
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'bg-secondary text-secondary-foreground'
}

export function PanelPage() {
  const {
    asistencias,
    commitEvento,
    createEvento,
    evento,
    eventos,
    isRemoteData,
    replaceAsistencias,
    replaceEventos,
    selectEvento,
    selectedView,
    setView,
    updatedAt,
    updateEvento,
  } = usePanelStore()
  const [isEventosLoading, setIsEventosLoading] = useState(false)
  const [isAsistenciasLoading, setIsAsistenciasLoading] = useState(false)
  const [isSavingEvento, setIsSavingEvento] = useState(false)
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false)
  const { theme, toggleTheme } = useThemeMode()
  const user = useSessionStore((state) => state.user)
  const signOut = useSessionStore((state) => state.signOut)

  const selectedStats = getAttendanceStats(evento.id, asistencias)
  const eventosActivosHoy = eventos.filter(
    (item) => getEventoAvailability(item).isActiveToday,
  ).length
  const currentCedula = cedulaFromAuthEmail(user?.email)
  const selectedAvailability = getEventoAvailability(evento)

  useEffect(() => {
    if (!isDataServiceConfigured) {
      return
    }

    let isMounted = true

    async function loadEventos() {
      setIsEventosLoading(true)

      try {
        const rows = await listarEventosPanel()

        if (!isMounted) {
          return
        }

        replaceEventos(rows)
      } catch (error) {
        if (!isMounted) {
          return
        }

        toast.error('No se pudieron cargar los eventos', {
          description:
            error instanceof Error
              ? error.message
              : 'Revisa la conexion e intenta nuevamente.',
        })
      } finally {
        if (isMounted) {
          setIsEventosLoading(false)
        }
      }
    }

    void loadEventos()

    return () => {
      isMounted = false
    }
  }, [replaceEventos])

  useEffect(() => {
    if (!isDataServiceConfigured || !isRemoteData) {
      return
    }

    let isMounted = true

    async function loadAsistencias() {
      setIsAsistenciasLoading(true)

      try {
        const rows = await listarAsistenciasPanel(evento.id)

        if (isMounted) {
          replaceAsistencias(rows)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        toast.error('No se pudieron cargar las asistencias', {
          description:
            error instanceof Error
              ? error.message
              : 'Revisa la conexion e intenta nuevamente.',
        })
      } finally {
        if (isMounted) {
          setIsAsistenciasLoading(false)
        }
      }
    }

    void loadAsistencias()

    return () => {
      isMounted = false
    }
  }, [evento.id, isRemoteData, replaceAsistencias])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isDataServiceConfigured) {
      updateEvento({})
      toast.success('Evento preparado', {
        description: 'El enlace se publicara cuando el servicio este disponible.',
      })
      return
    }

    setIsSavingEvento(true)

    try {
      const savedEvento = await guardarEventoPanel(evento)

      commitEvento(savedEvento)
      toast.success('Evento guardado', {
        description: 'El enlace publico ya usa este evento.',
      })
    } catch (error) {
      toast.error('No se pudo guardar el evento', {
        description:
          error instanceof Error
            ? error.message
            : 'Revisa los datos e intenta nuevamente.',
      })
    } finally {
      setIsSavingEvento(false)
    }
  }

  async function handleFlyerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!isDataServiceConfigured) {
      toast.error('No se pudo cargar el flyer', {
        description: 'El servicio no esta disponible en este entorno.',
      })
      return
    }

    setIsUploadingFlyer(true)

    try {
      const flyerUrl = await subirFlyerEvento(evento.id, file)

      updateEvento({ flyer_url: flyerUrl })
      toast.success('Flyer cargado', {
        description: 'Guarda el evento para publicar la imagen.',
      })
    } catch (error) {
      toast.error('No se pudo cargar el flyer', {
        description:
          error instanceof Error
            ? error.message
            : 'Selecciona otra imagen e intenta nuevamente.',
      })
    } finally {
      setIsUploadingFlyer(false)
    }
  }

  function openEvento(id: string, view: 'evento' | 'asistencias') {
    selectEvento(id)
    setView(view)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,var(--institutional-panel)_0%,var(--background)_42%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-card/80 px-4 py-4 shadow-sm backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-white sm:size-12">
              <img
                src={academiaLogo}
                alt="Academia Legislativa Instituto Superior"
                className="h-9 w-9 object-contain sm:h-10 sm:w-10"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Panel</p>
              <p className="truncate text-xs text-muted-foreground">
                Eventos y asistencias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentCedula ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <UserRound />
                {currentCedula}
              </Badge>
            ) : null}
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
                theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
              }
              title={
                theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
              }
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Salir"
              onClick={() => void signOut()}
            >
              <LogOut />
            </Button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 lg:grid-cols-[17rem_1fr]">
          <aside className="border-b bg-card/45 p-4 lg:border-r lg:border-b-0 lg:p-5">
            <nav className="grid grid-cols-3 gap-2 lg:grid-cols-1" aria-label="Panel">
              <Button
                type="button"
                variant={selectedView === 'eventos' ? 'secondary' : 'ghost'}
                className="h-10 justify-center px-2 lg:justify-start"
                onClick={() => setView('eventos')}
              >
                <LayoutGrid />
                <span className="hidden sm:inline">Eventos</span>
              </Button>
              <Button
                type="button"
                variant={selectedView === 'evento' ? 'secondary' : 'ghost'}
                className="h-10 justify-center px-2 lg:justify-start"
                onClick={() => setView('evento')}
              >
                <FilePenLine />
                <span className="hidden sm:inline">Evento</span>
              </Button>
              <Button
                type="button"
                variant={
                  selectedView === 'asistencias' ? 'secondary' : 'ghost'
                }
                className="h-10 justify-center px-2 lg:justify-start"
                onClick={() => setView('asistencias')}
              >
                <ListChecks />
                <span className="hidden sm:inline">Asistencias</span>
              </Button>
            </nav>

            <Separator className="my-5" />

            <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Seleccionado</p>
                <p className="mt-1 line-clamp-2 font-medium">{evento.nombre}</p>
              </div>
              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Estado hoy</p>
                <div className="mt-2">
                  <Badge className={getAvailabilityBadgeClass(evento)}>
                    <ShieldCheck />
                    {selectedAvailability.label}
                  </Badge>
                </div>
              </div>
              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Publicacion</p>
                <p className="mt-1 font-medium">
                  {isRemoteData
                    ? 'Publicado'
                    : isDataServiceConfigured
                      ? 'Pendiente de guardar'
                      : 'No publicado'}
                </p>
              </div>
              {updatedAt ? (
                <div className="rounded-md border bg-background/60 p-3 sm:col-span-3 lg:col-span-1">
                  <p className="text-xs text-muted-foreground">Actualizado</p>
                  <p className="mt-1 font-medium">
                    {formatDateTime(updatedAt)}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="p-4 sm:p-6 lg:p-8">
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Eventos</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <LayoutGrid className="size-5 text-[var(--institutional-gold)]" />
                    {eventos.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Activos hoy</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <BadgeCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                    {eventosActivosHoy}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Asistencias</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <UsersRound className="size-5 text-[var(--institutional-gold)]" />
                    {selectedStats.total}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {selectedView === 'eventos' ? (
              <section>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="text-xl font-semibold">Eventos cargados</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Selecciona un evento para editarlo o revisar sus asistencias.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="sm:w-auto"
                    onClick={createEvento}
                  >
                    <FilePenLine />
                    Nuevo evento
                  </Button>
                </div>

                {isEventosLoading ? (
                  <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando eventos
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {eventos.map((item) => {
                    const availability = getEventoAvailability(item)
                    const stats = getAttendanceStats(item.id, asistencias)

                    return (
                      <article
                        key={item.id}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-base font-semibold">
                              {item.nombre}
                            </h2>
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {item.lugar ?? 'Sin lugar'}
                            </p>
                          </div>
                          <Badge className={getAvailabilityBadgeClass(item)}>
                            {availability.label}
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarDays className="size-4" />
                            <span>
                              {formatDateRange(
                                item.fecha_desde,
                                item.fecha_hasta,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-4" />
                            <span>{item.radio_metros} metros</span>
                          </div>
                          <div className="grid grid-cols-3 rounded-md border bg-muted/35 p-2 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Total
                              </p>
                              <p className="font-semibold">{stats.total}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Dentro
                              </p>
                              <p className="font-semibold">{stats.dentro}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Fuera
                              </p>
                              <p className="font-semibold">{stats.fuera}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => openEvento(item.id, 'evento')}
                          >
                            <FilePenLine />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openEvento(item.id, 'evento')}
                          >
                            <QrCode />
                            QR
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openEvento(item.id, 'asistencias')}
                          >
                            <ListChecks />
                            Ver lista
                          </Button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {selectedView === 'evento' ? (
              <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
                <Card>
                  <CardHeader>
                    <CardTitle>Editar evento</CardTitle>
                    <CardDescription>
                      {selectedAvailability.message}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-5" onSubmit={handleSubmit}>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre del evento</Label>
                        <Input
                          id="nombre"
                          value={evento.nombre}
                          onChange={(event) =>
                            updateEvento({ nombre: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estado">Estado</Label>
                        <select
                          id="estado"
                          value={evento.estado}
                          onChange={(event) =>
                            updateEvento({
                              estado: event.target.value as EventoEstado,
                            })
                          }
                          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        >
                          {eventoEstados.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripcion</Label>
                      <Textarea
                        id="descripcion"
                        value={evento.descripcion ?? ''}
                        onChange={(event) =>
                          updateEvento({ descripcion: event.target.value })
                        }
                        className="min-h-24"
                      />
                    </div>

                    <div className="grid gap-4 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[1fr_15rem]">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="flyer_url">Flyer del evento</Label>
                          <div className="relative">
                            <ImageIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="flyer_url"
                              value={evento.flyer_url ?? ''}
                              onChange={(event) =>
                                updateEvento({ flyer_url: event.target.value })
                              }
                              placeholder="URL publica del flyer"
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="flyer_file">Cargar imagen</Label>
                          <Input
                            id="flyer_file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFlyerChange}
                            disabled={isUploadingFlyer || !isDataServiceConfigured}
                          />
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG o WebP. Maximo 5 MB.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-md border bg-background/70">
                        {evento.flyer_url ? (
                          <img
                            src={evento.flyer_url}
                            alt={`Flyer de ${evento.nombre}`}
                            className="h-56 w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-56 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
                            {isUploadingFlyer ? (
                              <Loader2 className="size-5 animate-spin" />
                            ) : (
                              <ImageUp className="size-5" />
                            )}
                            <span>
                              {isUploadingFlyer
                                ? 'Cargando flyer'
                                : 'Sin flyer cargado'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="lugar">Lugar</Label>
                        <Input
                          id="lugar"
                          value={evento.lugar ?? ''}
                          onChange={(event) =>
                            updateEvento({ lugar: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="direccion">Direccion</Label>
                        <Input
                          id="direccion"
                          value={evento.direccion ?? ''}
                          onChange={(event) =>
                            updateEvento({ direccion: event.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label>Ubicacion del evento</Label>
                          <p className="mt-1 text-sm text-muted-foreground">
                            OpenStreetMap
                          </p>
                        </div>
                        <Badge variant="secondary">
                          <MapPin />
                          OSM
                        </Badge>
                      </div>
                      <Suspense
                        fallback={
                          <div className="flex h-72 items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground sm:h-80">
                            Cargando mapa
                          </div>
                        }
                      >
                        <EventLocationMap
                          evento={evento}
                          onChange={(coordinates) => updateEvento(coordinates)}
                        />
                      </Suspense>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="latitud">Latitud</Label>
                        <Input
                          id="latitud"
                          type="number"
                          step="any"
                          value={evento.latitud}
                          onChange={(event) =>
                            updateEvento({
                              latitud: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="longitud">Longitud</Label>
                        <Input
                          id="longitud"
                          type="number"
                          step="any"
                          value={evento.longitud}
                          onChange={(event) =>
                            updateEvento({
                              longitud: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="radio">Radio en metros</Label>
                        <Input
                          id="radio"
                          type="number"
                          min={1}
                          value={evento.radio_metros}
                          onChange={(event) =>
                            updateEvento({
                              radio_metros: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="fecha_desde">Desde</Label>
                        <Input
                          id="fecha_desde"
                          type="date"
                          value={evento.fecha_desde}
                          onChange={(event) =>
                            updateEvento({ fecha_desde: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fecha_hasta">Hasta</Label>
                        <Input
                          id="fecha_hasta"
                          type="date"
                          value={evento.fecha_hasta}
                          onChange={(event) =>
                            updateEvento({ fecha_hasta: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hora_inicio">Inicio</Label>
                        <Input
                          id="hora_inicio"
                          type="time"
                          value={evento.hora_inicio ?? ''}
                          onChange={(event) =>
                            updateEvento({ hora_inicio: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hora_fin">Fin</Label>
                        <Input
                          id="hora_fin"
                          type="time"
                          value={evento.hora_fin ?? ''}
                          onChange={(event) =>
                            updateEvento({ hora_fin: event.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        El formulario publico solo permite marcar si este evento
                        esta activo en la fecha de hoy.
                      </p>
                      <Button
                        type="submit"
                        className="sm:w-auto"
                        disabled={isSavingEvento}
                      >
                        {isSavingEvento ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Save />
                        )}
                        {isSavingEvento ? 'Guardando' : 'Guardar cambios'}
                      </Button>
                    </div>
                    </form>
                  </CardContent>
                </Card>

                <div className="xl:sticky xl:top-6 xl:self-start">
                  <EventQrCard evento={evento} />
                </div>
              </div>
            ) : null}

            {selectedView === 'asistencias' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Asistencias</CardTitle>
                  <CardDescription>
                    {evento.nombre} · {selectedStats.total} registros
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por cedula, nombre o contacto"
                        className="pl-10"
                        disabled
                      />
                    </div>
                    <Button type="button" variant="outline" disabled>
                      <Download />
                      Exportar
                    </Button>
                  </div>

                  {isAsistenciasLoading ? (
                    <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando asistencias
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-md border">
                    <div className="hidden border-b bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[0.85fr_1fr_1.15fr_0.8fr_0.75fr_1fr]">
                      <span>Cedula</span>
                      <span>Nombre</span>
                      <span>Contacto</span>
                      <span>Dia</span>
                      <span>Distancia</span>
                      <span>Fecha</span>
                    </div>
                    <div className="divide-y">
                      {selectedStats.rows.map((row) => (
                        <div
                          key={row.id}
                          className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[0.85fr_1fr_1.15fr_0.8fr_0.75fr_1fr] md:items-center md:gap-2"
                        >
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Cedula
                            </p>
                            <p className="font-medium">{row.cedula}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Nombre
                            </p>
                            <p className="truncate text-muted-foreground">
                              {row.nombre_completo ?? 'Sin nombre'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Contacto
                            </p>
                            <div className="grid gap-1 text-muted-foreground">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Phone className="size-3.5 shrink-0" />
                                <span className="truncate">
                                  {row.telefono ?? 'Sin telefono'}
                                </span>
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Mail className="size-3.5 shrink-0" />
                                <span className="truncate">
                                  {row.email ?? 'Sin correo'}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Dia
                            </p>
                            <div className="grid gap-1">
                              <Badge variant="secondary">
                                {getEventoDayLabel(evento, row)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDateOnly(row.fecha_local)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Distancia
                            </p>
                            <Badge
                              variant={
                                row.dentro_del_cuadrante
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {formatMeters(row.distancia_metros)}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground md:hidden">
                              Fecha
                            </p>
                            <p className="flex items-center gap-2 text-muted-foreground">
                              <CalendarRange className="size-4" />
                              {formatDateTime(row.creado_en)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
                    <ClipboardList className="mt-0.5 size-4 shrink-0" />
                    <p>
                      La busqueda y exportacion quedan preparadas para la
                      siguiente etapa.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  )
}
