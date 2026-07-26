alter table asistencias.asistencia
  add column if not exists fecha_local date;

update asistencias.asistencia
set fecha_local = (creado_en at time zone 'America/Asuncion')::date
where fecha_local is null;

alter table asistencias.asistencia
  alter column fecha_local set default ((now() at time zone 'America/Asuncion')::date);

alter table asistencias.asistencia
  alter column fecha_local set not null;

create unique index if not exists uq_asistencia_evento_cedula_fecha_valida
  on asistencias.asistencia (evento_id, cedula, fecha_local)
  where dentro_del_cuadrante is true;

create index if not exists idx_asistencia_evento_cedula_fecha
  on asistencias.asistencia (evento_id, cedula, fecha_local desc);

create or replace function public.asistencias_registrar(
  p_evento_id uuid,
  p_cedula text,
  p_nombre_completo text,
  p_telefono text,
  p_email text,
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
  v_email text;
  v_evento asistencias.evento;
  v_fecha_local date;
  v_registros_hoy integer;
  v_telefono text;
begin
  v_fecha_local := (now() at time zone 'America/Asuncion')::date;
  v_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_telefono := nullif(trim(coalesce(p_telefono, '')), '');
  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));

  if length(v_cedula) < 5 then
    raise exception 'Ingresa una cedula valida.';
  end if;

  if v_telefono is null then
    raise exception 'Ingresa tu telefono.';
  end if;

  if length(v_telefono) > 30
    or length(regexp_replace(v_telefono, '\D', '', 'g')) < 6 then
    raise exception 'Ingresa un telefono valido.';
  end if;

  if v_email is null then
    raise exception 'Ingresa tu correo.';
  end if;

  if length(v_email) > 254
    or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Ingresa un correo valido.';
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
  where evento_id = v_evento.id
    and cedula = v_cedula
    and dentro_del_cuadrante is true
    and fecha_local = v_fecha_local;

  if v_registros_hoy >= 1 then
    raise exception 'Esta cedula ya registro asistencia hoy.';
  end if;

  insert into asistencias.asistencia (
    evento_id,
    cedula,
    nombre_completo,
    telefono,
    email,
    fecha_local,
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
    v_telefono,
    v_email,
    v_fecha_local,
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
exception
  when unique_violation then
    raise exception 'Esta cedula ya registro asistencia hoy.';
end;
$$;

grant execute on function public.asistencias_registrar(
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text
) to service_role;

notify pgrst, 'reload schema';
