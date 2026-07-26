import { supabase } from '@/lib/supabaseClient'
import type { Evento, EventoEstado } from '@/types/evento'

type EventoResponse = {
  evento: RawEvento | null
}

type EventosResponse = {
  eventos: RawEvento[]
}

type RawEvento = Omit<Evento, 'radio_metros'> & {
  radio_metros: number | string
}

type FunctionErrorContext = {
  context?: unknown
  error?: string
  message?: string
}

type JsonContext = {
  json: () => Promise<unknown>
}

type TextContext = {
  text: () => Promise<string>
}

function normalizeEvento(row: RawEvento): Evento {
  return {
    ...row,
    estado: row.estado as EventoEstado,
    radio_metros: Number(row.radio_metros),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasJson(value: unknown): value is JsonContext {
  return isRecord(value) && typeof value.json === 'function'
}

function hasText(value: unknown): value is TextContext {
  return isRecord(value) && typeof value.text === 'function'
}

function readErrorMessage(value: unknown) {
  if (isRecord(value) && typeof value.error === 'string') {
    return value.error
  }

  return null
}

async function readFunctionErrorMessage(context: unknown) {
  if (!context) {
    return null
  }

  if (typeof context === 'string') {
    return context
  }

  if (hasJson(context)) {
    const body = await context.json().catch(() => null)
    const message = readErrorMessage(body)

    if (message) {
      return message
    }
  }

  if (hasText(context)) {
    const text = await context.text().catch(() => '')

    if (text.trim()) {
      return text.trim()
    }
  }

  if (isRecord(context)) {
    return (
      readErrorMessage(context) ||
      (typeof context.message === 'string' ? context.message : null)
    )
  }

  return null
}

async function invokeEventos<T>(
  body: Record<string, unknown>,
  fallbackError: string,
  requireAuth = false,
) {
  if (!supabase) {
    throw new Error('Servicio no disponible.')
  }

  const headers: Record<string, string> = {}

  if (requireAuth) {
    const { data, error } = await supabase.auth.getSession()

    if (error || !data.session) {
      throw new Error('Debes iniciar sesion para usar el panel.')
    }

    headers.Authorization = `Bearer ${data.session.access_token}`
  }

  const { data, error } = await supabase.functions.invoke<T>('eventos', {
    body,
    headers,
  })

  if (error) {
    const context = (error as FunctionErrorContext).context
    const message = await readFunctionErrorMessage(context)

    throw new Error(message ?? error.message ?? fallbackError)
  }

  if (!data) {
    throw new Error(fallbackError)
  }

  return data
}

export async function obtenerEventoPublico(id: string) {
  const data = await invokeEventos<EventoResponse>(
    {
      action: 'get-public',
      id,
    },
    'No se pudo obtener el evento.',
  )

  return data.evento ? normalizeEvento(data.evento) : null
}

export async function obtenerEventoActualPublico() {
  const data = await invokeEventos<EventoResponse>(
    {
      action: 'get-current',
    },
    'No se pudo obtener el evento activo.',
  )

  return data.evento ? normalizeEvento(data.evento) : null
}

export async function listarEventosPanel() {
  const data = await invokeEventos<EventosResponse>(
    {
      action: 'list-panel',
    },
    'No se pudieron cargar los eventos.',
    true,
  )

  return data.eventos.map(normalizeEvento)
}

export async function guardarEventoPanel(evento: Evento) {
  const data = await invokeEventos<EventoResponse>(
    {
      action: 'save',
      evento,
    },
    'No se pudo guardar el evento.',
    true,
  )

  if (!data.evento) {
    throw new Error('El servicio no devolvio el evento guardado.')
  }

  return normalizeEvento(data.evento)
}
