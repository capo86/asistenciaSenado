import { createClient } from 'npm:@supabase/supabase-js@2'

type PadronRow = {
  apellido?: unknown
  cedula?: unknown
  departamento?: unknown
  distrito?: unknown
  distrito_descripcion?: unknown
  nombre?: unknown
  nombre_apellido?: unknown
}

type BuscarPersonaPayload = {
  cedula?: unknown
  evento_id?: unknown
}

type ContactoResumen = {
  email_mask: string | null
  registrado: boolean
  telefono_mask: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function normalizeCedula(value: unknown) {
  return String(value ?? '').replace(/\D/g, '')
}

function cleanOptionalText(value: unknown) {
  const text = String(value ?? '').trim()

  return text || null
}

function assertCedula(cedula: string) {
  if (!/^\d{5,10}$/.test(cedula)) {
    throw new HttpError(400, 'Ingresa una cedula valida.')
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(500, 'El servicio no esta configurado.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function parsePerson(row: PadronRow) {
  const nombre = cleanOptionalText(row.nombre)
  const apellido = cleanOptionalText(row.apellido)
  const nombreCompleto =
    cleanOptionalText(row.nombre_apellido) ||
    [nombre, apellido]
      .filter(Boolean)
      .join(' ')
  const cedula = cleanOptionalText(row.cedula)

  if (!cedula || !nombreCompleto) {
    throw new HttpError(500, 'La respuesta del padron no tiene nombre.')
  }

  return {
    cedula,
    apellido,
    departamento: cleanOptionalText(row.departamento),
    distrito:
      cleanOptionalText(row.distrito_descripcion) ||
      cleanOptionalText(row.distrito),
    nombre,
    nombre_completo: nombreCompleto,
  }
}

async function getContactoResumen(
  serviceClient: ReturnType<typeof createServiceClient>,
  eventoId: unknown,
  cedula: string,
) {
  if (!isUuid(eventoId)) {
    return null
  }

  const { data, error } = await serviceClient.rpc(
    'asistencias_contacto_resumen',
    {
      p_cedula: cedula,
      p_evento_id: eventoId,
    },
  )

  if (error || !data || typeof data !== 'object') {
    return null
  }

  const resumen = data as ContactoResumen

  return {
    email_mask:
      typeof resumen.email_mask === 'string' ? resumen.email_mask : null,
    registrado: resumen.registrado === true,
    telefono_mask:
      typeof resumen.telefono_mask === 'string'
        ? resumen.telefono_mask
        : null,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'Metodo no permitido.')
    }

    const payload = (await request.json().catch(() => ({}))) as
      BuscarPersonaPayload
    const cedula = normalizeCedula(payload.cedula)
    assertCedula(cedula)

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.rpc(
      'buscar_padron_por_cedula',
      {
        p_cedula: Number(cedula),
      },
    )

    if (error) {
      throw new HttpError(
        500,
        error.message || 'No se pudo consultar la cedula.',
      )
    }

    const firstRow = Array.isArray(data)
      ? (data[0] as PadronRow | undefined)
      : undefined

    if (!firstRow) {
      throw new HttpError(404, 'No se encontro una persona con esa cedula.')
    }

    return jsonResponse({
      data: {
        ...parsePerson(firstRow),
        contacto: await getContactoResumen(
          serviceClient,
          payload.evento_id,
          cedula,
        ),
      },
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status)
    }

    return jsonResponse({ error: 'No se pudo consultar la cedula.' }, 500)
  }
})
