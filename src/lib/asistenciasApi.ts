import { supabase } from '@/lib/supabaseClient'
import type { Asistencia } from '@/types/asistencia'

type RegistrarAsistenciaInput = {
  cedula: string
  email: string
  evento_id: string
  latitud: number
  longitud: number
  nombre_completo: string | null
  telefono: string
}

type RegistrarAsistenciaResponse = {
  asistencia: Asistencia
  registros_hoy: number
}

type ListarAsistenciasResponse = {
  asistencias: RawAsistencia[]
}

type RawAsistencia = Omit<Asistencia, 'distancia_metros'> & {
  distancia_metros: number | string | null
  fecha_local?: string | null
}

type FunctionErrorContext = {
  context?: unknown
}

type JsonContext = {
  json: () => Promise<unknown>
}

type TextContext = {
  text: () => Promise<string>
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

export async function registrarAsistencia(input: RegistrarAsistenciaInput) {
  if (!supabase) {
    throw new Error('Servicio no disponible.')
  }

  const { data, error } =
    await supabase.functions.invoke<RegistrarAsistenciaResponse>(
      'registrar-asistencia',
      {
        body: input,
      },
    )

  if (error) {
    const context = (error as FunctionErrorContext).context
    const message = await readFunctionErrorMessage(context)

    throw new Error(message ?? error.message ?? 'No se pudo registrar.')
  }

  if (!data?.asistencia) {
    throw new Error('No se pudo confirmar el registro.')
  }

  return data
}

function normalizeAsistencia(row: RawAsistencia): Asistencia {
  return {
    ...row,
    distancia_metros:
      row.distancia_metros === null ? null : Number(row.distancia_metros),
    fecha_local: row.fecha_local ?? row.creado_en.slice(0, 10),
  }
}

export async function listarAsistenciasPanel(eventoId: string) {
  if (!supabase) {
    throw new Error('Servicio no disponible.')
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()

  if (sessionError || !sessionData.session) {
    throw new Error('Debes iniciar sesion para usar el panel.')
  }

  const { data, error } =
    await supabase.functions.invoke<ListarAsistenciasResponse>('eventos', {
      body: {
        action: 'list-asistencias-panel',
        evento_id: eventoId,
      },
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    })

  if (error) {
    const context = (error as FunctionErrorContext).context
    const message = await readFunctionErrorMessage(context)

    throw new Error(message ?? error.message ?? 'No se pudo cargar la lista.')
  }

  return (data?.asistencias ?? []).map(normalizeAsistencia)
}
