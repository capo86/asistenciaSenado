import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Asistencia } from '@/types/asistencia'
import type { Evento, EventoEstado } from '@/types/evento'

type PanelView = 'eventos' | 'evento' | 'asistencias'

type PanelState = {
  asistencias: Asistencia[]
  evento: Evento
  eventos: Evento[]
  isRemoteData: boolean
  selectedEventoId: string
  selectedView: PanelView
  updatedAt: string | null
  createEvento: () => void
  commitEvento: (row: Evento) => void
  replaceAsistencias: (rows: Asistencia[]) => void
  replaceEventos: (rows: Evento[]) => void
  selectEvento: (id: string) => void
  setView: (view: PanelView) => void
  updateEvento: (changes: Partial<Evento>) => void
}

type PersistedPanelState = Pick<
  PanelState,
  | 'asistencias'
  | 'evento'
  | 'eventos'
  | 'isRemoteData'
  | 'selectedEventoId'
  | 'selectedView'
  | 'updatedAt'
>

function toDateInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 10)
}

const today = new Date()
const todayValue = toDateInputValue(today)

function createEventId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `local-${Date.now()}`
}

function createBlankEvento(): Evento {
  const now = new Date().toISOString()

  return {
    id: createEventId(),
    nombre: 'Nuevo evento',
    descripcion: null,
    lugar: 'Poder Legislativo',
    direccion: 'Camara de Senadores',
    latitud: -25.282_197,
    longitud: -57.635_1,
    radio_metros: 100,
    fecha_desde: todayValue,
    fecha_hasta: todayValue,
    hora_inicio: '08:00',
    hora_fin: '18:00',
    flyer_url: null,
    estado: 'activo',
    creado_en: now,
    modificado_en: now,
    usuario_alta: null,
    usuario_modificacion: null,
  }
}

const initialEvento = createBlankEvento()
const initialEventos: Evento[] = [initialEvento]
const initialAsistencias: Asistencia[] = []

export const eventoEstados: EventoEstado[] = [
  'borrador',
  'activo',
  'finalizado',
  'cancelado',
]

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      asistencias: initialAsistencias,
      evento: initialEventos[0],
      eventos: initialEventos,
      isRemoteData: false,
      selectedEventoId: initialEventos[0].id,
      selectedView: 'eventos',
      updatedAt: null,
      createEvento: () =>
        set((state) => {
          const nextEvento = createBlankEvento()

          return {
            evento: nextEvento,
            eventos: [nextEvento, ...state.eventos],
            selectedEventoId: nextEvento.id,
            selectedView: 'evento',
            updatedAt: nextEvento.modificado_en,
          }
        }),
      commitEvento: (row) =>
        set((state) => {
          const filteredEventos = state.eventos.filter(
            (evento) =>
              evento.id !== state.selectedEventoId && evento.id !== row.id,
          )

          return {
            evento: row,
            eventos: [row, ...filteredEventos],
            isRemoteData: true,
            selectedEventoId: row.id,
            updatedAt: row.modificado_en,
          }
        }),
      replaceAsistencias: (rows) => set({ asistencias: rows }),
      replaceEventos: (rows) =>
        set((state) => {
          const selectedEvento =
            rows.find((row) => row.id === state.selectedEventoId) ?? rows[0]

          if (!selectedEvento) {
            const nextEvento = createBlankEvento()

            return {
              evento: nextEvento,
              eventos: [nextEvento],
              isRemoteData: false,
              selectedEventoId: nextEvento.id,
              selectedView: 'evento',
              updatedAt: null,
            }
          }

          return {
            evento: selectedEvento,
            eventos: rows,
            isRemoteData: true,
            selectedEventoId: selectedEvento.id,
          }
        }),
      selectEvento: (id) =>
        set((state) => {
          const selectedEvento = state.eventos.find((evento) => evento.id === id)

          if (!selectedEvento) {
            return state
          }

          return {
            evento: selectedEvento,
            selectedEventoId: id,
          }
        }),
      setView: (view) => set({ selectedView: view }),
      updateEvento: (changes) =>
        set((state) => {
          const modificadoEn = new Date().toISOString()
          const nextEvento = {
            ...state.evento,
            ...changes,
            modificado_en: modificadoEn,
          }

          return {
            evento: nextEvento,
            eventos: state.eventos.map((evento) =>
              evento.id === nextEvento.id ? nextEvento : evento,
            ),
            updatedAt: modificadoEn,
          }
        }),
    }),
    {
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedPanelState>
        const eventos =
          persisted.eventos && persisted.eventos.length > 0
            ? persisted.eventos
            : currentState.eventos
        const selectedEventoId =
          persisted.selectedEventoId ?? currentState.selectedEventoId
        const selectedEvento =
          eventos.find((evento) => evento.id === selectedEventoId) ??
          persisted.evento ??
          eventos[0] ??
          currentState.evento

        return {
          ...currentState,
          ...persisted,
          evento: selectedEvento,
          eventos,
          isRemoteData: persisted.isRemoteData ?? currentState.isRemoteData,
          selectedEventoId: selectedEvento.id,
          selectedView: persisted.selectedView ?? currentState.selectedView,
        }
      },
      name: 'asistencia-isal-panel-v3',
      partialize: (state): PersistedPanelState => ({
        asistencias: state.asistencias,
        evento: state.evento,
        eventos: state.eventos,
        isRemoteData: state.isRemoteData,
        selectedEventoId: state.selectedEventoId,
        selectedView: state.selectedView,
        updatedAt: state.updatedAt,
      }),
      version: 1,
    },
  ),
)
