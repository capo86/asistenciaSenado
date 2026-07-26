create or replace function public.asistencias_evento_get_public(p_id uuid)
returns setof asistencias.evento
language sql
security definer
set search_path = asistencias, public
as $$
  select *
  from asistencias.evento
  where id = p_id
    and estado = 'activo'
  limit 1;
$$;

create or replace function public.asistencias_evento_get_current()
returns setof asistencias.evento
language sql
security definer
set search_path = asistencias, public
as $$
  select *
  from asistencias.evento
  where estado = 'activo'
    and fecha_desde <= (now() at time zone 'America/Asuncion')::date
    and fecha_hasta >= (now() at time zone 'America/Asuncion')::date
  order by fecha_desde desc, creado_en desc
  limit 1;
$$;

create or replace function public.asistencias_evento_list_panel()
returns setof asistencias.evento
language sql
security definer
set search_path = asistencias, public
as $$
  select *
  from asistencias.evento
  order by fecha_desde desc, creado_en desc;
$$;

create or replace function public.asistencias_evento_save(
  p_evento jsonb,
  p_user_id uuid
)
returns asistencias.evento
language plpgsql
security definer
set search_path = asistencias, public
as $$
declare
  v_id uuid;
  v_row asistencias.evento;
begin
  if p_evento ? 'id' and nullif(p_evento ->> 'id', '') is not null then
    v_id := (p_evento ->> 'id')::uuid;
  end if;

  if v_id is null then
    insert into asistencias.evento (
      nombre,
      descripcion,
      lugar,
      direccion,
      latitud,
      longitud,
      radio_metros,
      fecha_desde,
      fecha_hasta,
      hora_inicio,
      hora_fin,
      flyer_url,
      estado,
      usuario_alta,
      usuario_modificacion
    )
    values (
      p_evento ->> 'nombre',
      nullif(p_evento ->> 'descripcion', ''),
      nullif(p_evento ->> 'lugar', ''),
      nullif(p_evento ->> 'direccion', ''),
      (p_evento ->> 'latitud')::double precision,
      (p_evento ->> 'longitud')::double precision,
      (p_evento ->> 'radio_metros')::numeric,
      (p_evento ->> 'fecha_desde')::date,
      (p_evento ->> 'fecha_hasta')::date,
      nullif(p_evento ->> 'hora_inicio', '')::time,
      nullif(p_evento ->> 'hora_fin', '')::time,
      nullif(p_evento ->> 'flyer_url', ''),
      (p_evento ->> 'estado')::asistencias.evento_estado,
      p_user_id,
      p_user_id
    )
    returning * into v_row;

    return v_row;
  end if;

  insert into asistencias.evento (
    id,
    nombre,
    descripcion,
    lugar,
    direccion,
    latitud,
    longitud,
    radio_metros,
    fecha_desde,
    fecha_hasta,
    hora_inicio,
    hora_fin,
    flyer_url,
    estado,
    usuario_alta,
    usuario_modificacion
  )
  values (
    v_id,
    p_evento ->> 'nombre',
    nullif(p_evento ->> 'descripcion', ''),
    nullif(p_evento ->> 'lugar', ''),
    nullif(p_evento ->> 'direccion', ''),
    (p_evento ->> 'latitud')::double precision,
    (p_evento ->> 'longitud')::double precision,
    (p_evento ->> 'radio_metros')::numeric,
    (p_evento ->> 'fecha_desde')::date,
    (p_evento ->> 'fecha_hasta')::date,
    nullif(p_evento ->> 'hora_inicio', '')::time,
    nullif(p_evento ->> 'hora_fin', '')::time,
    nullif(p_evento ->> 'flyer_url', ''),
    (p_evento ->> 'estado')::asistencias.evento_estado,
    p_user_id,
    p_user_id
  )
  on conflict (id) do update
    set nombre = excluded.nombre,
        descripcion = excluded.descripcion,
        lugar = excluded.lugar,
        direccion = excluded.direccion,
        latitud = excluded.latitud,
        longitud = excluded.longitud,
        radio_metros = excluded.radio_metros,
        fecha_desde = excluded.fecha_desde,
        fecha_hasta = excluded.fecha_hasta,
        hora_inicio = excluded.hora_inicio,
        hora_fin = excluded.hora_fin,
        flyer_url = excluded.flyer_url,
        estado = excluded.estado,
        usuario_modificacion = p_user_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.asistencias_evento_get_public(uuid)
  to anon, authenticated, service_role;

grant execute on function public.asistencias_evento_get_current()
  to anon, authenticated, service_role;

grant execute on function public.asistencias_evento_list_panel()
  to service_role;

grant execute on function public.asistencias_evento_save(jsonb, uuid)
  to service_role;
