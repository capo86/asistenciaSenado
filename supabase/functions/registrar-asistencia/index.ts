import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type RegistrarAsistenciaBody = {
  cedula?: string
  email?: string | null
  evento_id?: string
  latitud?: number
  longitud?: number
  nombre_completo?: string | null
  telefono?: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Falta configurar ${name}.`)
  }

  return value
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

  return 'No se pudo registrar la asistencia.'
}

function getClientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}

function assertUuid(value: string | undefined) {
  if (
    !value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  ) {
    throw new Error('Evento no disponible.')
  }

  return value
}

function assertNumber(value: number | undefined, message: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(message)
  }

  return value
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
    const client = createClient(supabaseUrl, serviceRoleKey)
    const body = (await req.json()) as RegistrarAsistenciaBody

    const { data, error } = await client.rpc('asistencias_registrar', {
      p_cedula: body.cedula ?? '',
      p_email: body.email ?? null,
      p_evento_id: assertUuid(body.evento_id),
      p_ip_address: getClientIp(req),
      p_latitud: assertNumber(
        body.latitud,
        'No se pudo validar la ubicacion.',
      ),
      p_longitud: assertNumber(
        body.longitud,
        'No se pudo validar la ubicacion.',
      ),
      p_nombre_completo: body.nombre_completo ?? null,
      p_telefono: body.telefono ?? null,
    })

    if (error) {
      throw error
    }

    return jsonResponse(data)
  } catch (error) {
    const message = getErrorMessage(error)
    const status = message.includes('limite diario') ? 429 : 400

    return jsonResponse({ error: message }, status)
  }
})
