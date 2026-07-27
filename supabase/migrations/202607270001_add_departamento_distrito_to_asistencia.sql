alter table asistencias.asistencia
  add column if not exists departamento text,
  add column if not exists distrito text;

drop function if exists public.asistencias_registrar(
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text
);

create or replace function public.asistencias_registrar(
  p_evento_id uuid,
  p_cedula text,
  p_nombre_completo text,
  p_telefono text,
  p_email text,
  p_latitud double precision,
  p_longitud double precision,
  p_device_id text default null,
  p_user_agent text default null,
  p_ip_address text default null,
  p_departamento text default null,
  p_distrito text default null
)
returns jsonb
language plpgsql
security definer
set search_path = asistencias, public
as $$
declare
  v_asistencia asistencias.asistencia;
  v_cedula text;
  v_constraint_name text;
  v_departamento text;
  v_device_id text;
  v_distancia double precision;
  v_distrito text;
  v_email text;
  v_evento asistencias.evento;
  v_fecha_local date;
  v_previous_email text;
  v_previous_telefono text;
  v_registros_hoy integer;
  v_telefono text;
  v_user_agent text;
begin
  v_fecha_local := (now() at time zone 'America/Asuncion')::date;
  v_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_telefono := nullif(trim(coalesce(p_telefono, '')), '');
  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_device_id := nullif(trim(coalesce(p_device_id, '')), '');
  v_user_agent := nullif(left(trim(coalesce(p_user_agent, '')), 500), '');
  v_departamento := nullif(left(trim(coalesce(p_departamento, '')), 120), '');
  v_distrito := nullif(left(trim(coalesce(p_distrito, '')), 120), '');

  if length(v_cedula) < 5 then
    raise exception 'Ingresa una cedula valida.';
  end if;

  if p_latitud is null or p_longitud is null then
    raise exception 'No se pudo validar la ubicacion.';
  end if;

  if v_device_id is null
    or length(v_device_id) < 16
    or length(v_device_id) > 120 then
    raise exception 'No se pudo validar el dispositivo.';
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

  select telefono, email
  into v_previous_telefono, v_previous_email
  from asistencias.asistencia
  where evento_id = v_evento.id
    and cedula = v_cedula
    and dentro_del_cuadrante is true
    and telefono is not null
    and email is not null
  order by creado_en desc
  limit 1;

  v_telefono := coalesce(v_telefono, v_previous_telefono);
  v_email := coalesce(v_email, v_previous_email);

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

  if v_device_id is not null
    and exists (
      select 1
      from asistencias.asistencia
      where evento_id = v_evento.id
        and device_id = v_device_id
        and fecha_local = v_fecha_local
        and dentro_del_cuadrante is true
        and cedula <> v_cedula
    ) then
    raise exception 'Este dispositivo ya registro una asistencia hoy.';
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

  insert into asistencias.asistencia (
    evento_id,
    cedula,
    nombre_completo,
    departamento,
    distrito,
    telefono,
    email,
    fecha_local,
    latitud,
    longitud,
    distancia_metros,
    dentro_del_cuadrante,
    ip_address,
    device_id,
    user_agent
  )
  values (
    v_evento.id,
    v_cedula,
    nullif(trim(coalesce(p_nombre_completo, '')), ''),
    v_departamento,
    v_distrito,
    v_telefono,
    v_email,
    v_fecha_local,
    p_latitud,
    p_longitud,
    v_distancia,
    true,
    nullif(trim(coalesce(p_ip_address, '')), ''),
    v_device_id,
    v_user_agent
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
    get stacked diagnostics v_constraint_name = constraint_name;

    if v_constraint_name = 'uq_asistencia_evento_device_fecha_valida' then
      raise exception 'Este dispositivo ya registro una asistencia hoy.';
    end if;

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
  text,
  text,
  text,
  text,
  text
) to service_role;

notify pgrst, 'reload schema';
