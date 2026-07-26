drop index if exists asistencias.uq_asistencia_evento_cedula_valida;

create index if not exists idx_asistencia_cedula_creado
  on asistencias.asistencia (cedula, creado_en desc);

create or replace function public.asistencias_registrar(
  p_evento_id uuid,
  p_cedula text,
  p_nombre_completo text,
  p_latitud double precision,
  p_longitud double precision,
  p_ip_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = asistencias, public
as $$
declare
  v_asistencia asistencias.asistencia;
  v_cedula text;
  v_distancia double precision;
  v_evento asistencias.evento;
  v_fecha_local date;
  v_registros_hoy integer;
begin
  v_fecha_local := (now() at time zone 'America/Asuncion')::date;
  v_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');

  if length(v_cedula) < 5 then
    raise exception 'Ingresa una cedula valida.';
  end if;

  if p_latitud is null or p_longitud is null then
    raise exception 'No se pudo validar la ubicacion.';
  end if;

  select *
  into v_evento
  from asistencias.evento
  where id = p_evento_id
    and estado = 'activo'
  limit 1;

  if not found then
    raise exception 'Evento no disponible.';
  end if;

  if v_fecha_local < v_evento.fecha_desde
    or v_fecha_local > v_evento.fecha_hasta then
    raise exception 'Evento no disponible hoy.';
  end if;

  v_distancia := asistencias.distancia_metros(
    v_evento.latitud,
    v_evento.longitud,
    p_latitud,
    p_longitud
  );

  if v_distancia > v_evento.radio_metros then
    raise exception 'No se encuentra en el local.';
  end if;

  select count(*)::integer
  into v_registros_hoy
  from asistencias.asistencia
  where cedula = v_cedula
    and dentro_del_cuadrante is true
    and (creado_en at time zone 'America/Asuncion')::date = v_fecha_local;

  if v_registros_hoy >= 2 then
    raise exception 'Esta cedula ya alcanzo el limite diario de registros.';
  end if;

  insert into asistencias.asistencia (
    evento_id,
    cedula,
    nombre_completo,
    latitud,
    longitud,
    distancia_metros,
    dentro_del_cuadrante,
    ip_address
  )
  values (
    v_evento.id,
    v_cedula,
    nullif(trim(coalesce(p_nombre_completo, '')), ''),
    p_latitud,
    p_longitud,
    v_distancia,
    true,
    nullif(trim(coalesce(p_ip_address, '')), '')
  )
  returning * into v_asistencia;

  return jsonb_build_object(
    'asistencia',
    to_jsonb(v_asistencia),
    'registros_hoy',
    v_registros_hoy + 1
  );
end;
$$;

grant execute on function public.asistencias_registrar(
  uuid,
  text,
  text,
  double precision,
  double precision,
  text
) to service_role;
