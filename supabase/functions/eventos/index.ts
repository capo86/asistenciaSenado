import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type EventoEstado = 'borrador' | 'activo' | 'finalizado' | 'cancelado'

type EventoPayload = {
  id?: string | null
  nombre?: string | null
  descripcion?: string | null
  lugar?: string | null
  direccion?: string | null
  latitud?: number | null
  longitud?: number | null
  radio_metros?: number | null
  fecha_desde?: string | null
  fecha_hasta?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  flyer_url?: string | null
  estado?: EventoEstado | null
}

type RequestBody =
  | { action: 'get-public'; id: string }
  | { action: 'get-current' }
  | { action: 'list-panel' }
  | { action: 'list-asistencias-panel'; evento_id: string }
  | { action: 'save'; evento: EventoPayload }

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const estadoValues = new Set<EventoEstado>([
  'borrador',
  'activo',
  'finalizado',
  'cancelado',
])

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'No se pudo procesar la solicitud.'
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Falta configurar ${name}.`)
  }

  return value
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  )
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim()
  return text ? text : null
}

function cleanRequiredText(value: string | null | undefined, fieldName: string) {
  const text = cleanText(value)

  if (!text) {
    throw new Error(`${fieldName} es obligatorio.`)
  }

  return text
}

function cleanNumber(value: number | null | undefined, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} debe ser numerico.`)
  }

  return value
}

function cleanPositiveNumber(
  value: number | null | undefined,
  fieldName: string,
) {
  const numberValue = cleanNumber(value, fieldName)

  if (numberValue <= 0) {
    throw new Error(`${fieldName} debe ser mayor a cero.`)
  }

  return numberValue
}

function cleanDate(value: string | null | undefined, fieldName: string) {
  const text = cleanRequiredText(value, fieldName)

  if (!text.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error(`${fieldName} debe tener formato YYYY-MM-DD.`)
  }

  return text
}

function cleanTime(value: string | null | undefined) {
  const text = cleanText(value)

  if (!text) {
    return null
  }

  if (!text.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
    throw new Error('El horario debe tener formato HH:mm.')
  }

  return text
}

function cleanEstado(value: EventoEstado | null | undefined) {
  if (!value || !estadoValues.has(value)) {
    throw new Error('Estado de evento invalido.')
  }

  return value
}

function cleanEventoPayload(evento: EventoPayload, userId: string) {
  const fechaDesde = cleanDate(evento.fecha_desde, 'fecha_desde')
  const fechaHasta = cleanDate(evento.fecha_hasta, 'fecha_hasta')

  if (fechaHasta < fechaDesde) {
    throw new Error('La fecha hasta no puede ser anterior a la fecha desde.')
  }

  const row = {
    descripcion: cleanText(evento.descripcion),
    direccion: cleanText(evento.direccion),
    estado: cleanEstado(evento.estado ?? 'borrador'),
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    flyer_url: cleanText(evento.flyer_url),
    hora_fin: cleanTime(evento.hora_fin),
    hora_inicio: cleanTime(evento.hora_inicio),
    latitud: cleanNumber(evento.latitud, 'latitud'),
    longitud: cleanNumber(evento.longitud, 'longitud'),
    lugar: cleanText(evento.lugar),
    nombre: cleanRequiredText(evento.nombre, 'nombre'),
    radio_metros: cleanPositiveNumber(evento.radio_metros, 'radio_metros'),
    usuario_modificacion: userId,
  }

  if (isUuid(evento.id)) {
    return {
      ...row,
      id: evento.id,
    }
  }

  return {
    ...row,
    usuario_alta: userId,
  }
}

async function getAuthenticatedUser(req: Request) {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    throw new Error('Debes iniciar sesion para usar el panel.')
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })
  const { data, error } = await authClient.auth.getUser()

  if (error || !data.user) {
    throw new Error('Sesion invalida o vencida.')
  }

  return data.user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido.' }, 405)
  }

  try {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const body = (await req.json()) as RequestBody

    if (body.action === 'get-public') {
      if (!isUuid(body.id)) {
        return jsonResponse({ error: 'Evento no encontrado.' }, 404)
      }

      const { data, error } = await serviceClient
        .rpc('asistencias_evento_get_public', {
          p_id: body.id,
        })
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        return jsonResponse({ error: 'Evento no encontrado.' }, 404)
      }

      return jsonResponse({ evento: data })
    }

    if (body.action === 'get-current') {
      const { data, error } = await serviceClient
        .rpc('asistencias_evento_get_current')
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        return jsonResponse({ evento: null })
      }

      return jsonResponse({ evento: data })
    }

    if (body.action === 'list-panel') {
      await getAuthenticatedUser(req)

      const { data, error } = await serviceClient
        .rpc('asistencias_evento_list_panel')

      if (error) {
        throw error
      }

      return jsonResponse({ eventos: data ?? [] })
    }

    if (body.action === 'list-asistencias-panel') {
      await getAuthenticatedUser(req)

      if (!isUuid(body.evento_id)) {
        return jsonResponse({ error: 'Evento no disponible.' }, 400)
      }

      const { data, error } = await serviceClient.rpc(
        'asistencias_list_panel',
        {
          p_evento_id: body.evento_id,
        },
      )

      if (error) {
        throw error
      }

      return jsonResponse({ asistencias: data ?? [] })
    }

    if (body.action === 'save') {
      const user = await getAuthenticatedUser(req)
      const payload = cleanEventoPayload(body.evento, user.id)

      const { data, error } = await serviceClient
        .rpc('asistencias_evento_save', {
          p_evento: payload,
          p_user_id: user.id,
        })
        .single()

      if (error) {
        throw error
      }

      return jsonResponse({ evento: data })
    }

    return jsonResponse({ error: 'Accion no soportada.' }, 400)
  } catch (error) {
    return jsonResponse({ error: getErrorMessage(error) }, 400)
  }
})
