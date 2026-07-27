alter table asistencias.asistencia
  add column if not exists device_id text,
  add column if not exists user_agent text;

create index if not exists idx_asistencia_evento_device_fecha
  on asistencias.asistencia (evento_id, device_id, fecha_local desc)
  where device_id is not null;

create unique index if not exists uq_asistencia_evento_device_fecha_valida
  on asistencias.asistencia (evento_id, device_id, fecha_local)
  where dentro_del_cuadrante is true
    and device_id is not null;

create or replace function public.asistencias_contacto_resumen(
  p_evento_id uuid,
  p_cedula text
)
returns jsonb
language plpgsql
security definer
set search_path = asistencias, public
as $$
declare
  v_cedula text;
  v_email text;
  v_email_domain text;
  v_email_local text;
  v_telefono text;
  v_telefono_digits text;
begin
  v_cedula := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');

  if length(v_cedula) < 5 then
    return jsonb_build_object(
      'registrado',
      false,
      'telefono_mask',
      null,
      'email_mask',
      null
    );
  end if;

  select telefono, email
  into v_telefono, v_email
  from asistencias.asistencia
  where evento_id = p_evento_id
    and cedula = v_cedula
    and dentro_del_cuadrante is true
    and telefono is not null
    and email is not null
  order by creado_en desc
  limit 1;

  if v_telefono is null or v_email is null then
    return jsonb_build_object(
      'registrado',
      false,
      'telefono_mask',
      null,
      'email_mask',
      null
    );
  end if;

  v_telefono_digits := regexp_replace(v_telefono, '\D', '', 'g');
  v_email_local := split_part(v_email, '@', 1);
  v_email_domain := split_part(v_email, '@', 2);

  return jsonb_build_object(
    'registrado',
    true,
    'telefono_mask',
    case
      when length(v_telefono_digits) >= 4 then
        left(v_telefono_digits, 2) ||
        repeat('*', greatest(length(v_telefono_digits) - 4, 0)) ||
        right(v_telefono_digits, 2)
      else 'Registrado'
    end,
    'email_mask',
    case
      when v_email_local <> '' and v_email_domain <> '' then
        left(v_email_local, 1) || '***@' || v_email_domain
      else 'Registrado'
    end
  );
end;
$$;

grant execute on function public.asistencias_contacto_resumen(uuid, text)
  to service_role;

drop function if exists public.asistencias_registrar(
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
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
  v_constraint_name text;
  v_device_id text;
  v_distancia double precision;
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
  text
) to service_role;

notify pgrst, 'reload schema';
