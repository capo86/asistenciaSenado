import { supabase } from '@/lib/supabaseClient'
import type { Persona } from '@/types/persona'

type BuscarPersonaResponse = {
  data?: Persona
  error?: string
}

type FunctionErrorWithContext = {
  context?: unknown
  message?: string
}

type JsonContext = {
  json: () => Promise<unknown>
}

type TextContext = {
  text: () => Promise<string>
}

function normalizeCedula(value: string) {
  return value.replace(/\D/g, '')
}

function readErrorMessage(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error
  }

  return null
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

export async function buscarPersonaPorCedula(cedula: string, eventoId?: string) {
  if (!supabase) {
    throw new Error('Servicio no disponible.')
  }

  const normalizedCedula = normalizeCedula(cedula)

  if (!/^\d{5,10}$/.test(normalizedCedula)) {
    throw new Error('Ingresa una cedula valida.')
  }

  const { data, error } =
    await supabase.functions.invoke<BuscarPersonaResponse>('buscar-persona', {
      body: {
        cedula: normalizedCedula,
        evento_id: eventoId,
      },
    })

  if (error) {
    const context = (error as FunctionErrorWithContext).context
    const contextMessage = await readFunctionErrorMessage(context)

    if (contextMessage) {
      throw new Error(contextMessage)
    }

    throw new Error(error.message || 'No se pudo consultar la cedula.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (!data?.data) {
    throw new Error('La respuesta del servicio no tiene datos.')
  }

  return data.data
}
