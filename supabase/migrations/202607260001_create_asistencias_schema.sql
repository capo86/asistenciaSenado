create schema if not exists asistencias;

grant usage on schema asistencias to anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'asistencias'
      and t.typname = 'evento_estado'
  ) then
    create type asistencias.evento_estado as enum (
      'borrador',
      'activo',
      'finalizado',
      'cancelado'
    );
  end if;
end $$;

create or replace function asistencias.set_modificado_en()
returns trigger
language plpgsql
as $$
begin
  new.modificado_en = now();
  return new;
end;
$$;

create or replace function asistencias.distancia_metros(
  latitud_origen double precision,
  longitud_origen double precision,
  latitud_destino double precision,
  longitud_destino double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(
    sqrt(
      power(sin(radians((latitud_destino - latitud_origen) / 2)), 2) +
      cos(radians(latitud_origen)) *
      cos(radians(latitud_destino)) *
      power(sin(radians((longitud_destino - longitud_origen) / 2)), 2)
    )
  );
$$;

create table if not exists asistencias.evento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  lugar text,
  direccion text,
  latitud double precision not null,
  longitud double precision not null,
  radio_metros numeric not null default 100 check (radio_metros > 0),
  fecha_desde date not null,
  fecha_hasta date not null,
  hora_inicio time,
  hora_fin time,
  flyer_url text,
  estado asistencias.evento_estado not null default 'borrador',
  creado_en timestamptz not null default now(),
  modificado_en timestamptz not null default now(),
  usuario_alta uuid,
  usuario_modificacion uuid,
  constraint evento_rango_fechas_valido check (fecha_hasta >= fecha_desde)
);

drop trigger if exists trg_evento_set_modificado_en on asistencias.evento;

create trigger trg_evento_set_modificado_en
before update on asistencias.evento
for each row
execute function asistencias.set_modificado_en();

create table if not exists asistencias.asistencia (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references asistencias.evento(id) on delete cascade,
  cedula text not null,
  nombre_completo text,
  latitud double precision not null,
  longitud double precision not null,
  distancia_metros numeric,
  dentro_del_cuadrante boolean not null,
  ip_address text,
  creado_en timestamptz not null default now(),
  constraint asistencia_cedula_no_vacia check (length(trim(cedula)) > 0)
);

create table if not exists asistencias.rate_limit_intento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references asistencias.evento(id) on delete cascade,
  cedula text,
  ip_address text,
  creado_en timestamptz not null default now()
);

create unique index if not exists uq_asistencia_evento_cedula_valida
  on asistencias.asistencia (evento_id, cedula)
  where dentro_del_cuadrante is true;

create index if not exists idx_asistencia_evento_creado
  on asistencias.asistencia (evento_id, creado_en desc);

create index if not exists idx_asistencia_cedula
  on asistencias.asistencia (cedula);

create index if not exists idx_asistencia_dentro_evento
  on asistencias.asistencia (evento_id, dentro_del_cuadrante);

create index if not exists idx_rate_limit_cedula_fecha
  on asistencias.rate_limit_intento (cedula, creado_en desc);

create index if not exists idx_rate_limit_ip_fecha
  on asistencias.rate_limit_intento (ip_address, creado_en desc);

alter table asistencias.evento enable row level security;
alter table asistencias.asistencia enable row level security;
alter table asistencias.rate_limit_intento enable row level security;

drop policy if exists "lectura publica eventos activos" on asistencias.evento;
drop policy if exists "lectura autenticada eventos" on asistencias.evento;
drop policy if exists "sin escritura directa asistencia anon" on asistencias.asistencia;
drop policy if exists "sin escritura directa rate limit anon" on asistencias.rate_limit_intento;

create policy "lectura publica eventos activos"
on asistencias.evento
for select
to anon
using (estado = 'activo');

create policy "lectura autenticada eventos"
on asistencias.evento
for select
to authenticated
using (true);

create policy "sin escritura directa asistencia anon"
on asistencias.asistencia
for insert
to anon
with check (false);

create policy "sin escritura directa rate limit anon"
on asistencias.rate_limit_intento
for insert
to anon
with check (false);

grant select on asistencias.evento to anon, authenticated;
grant select on asistencias.asistencia to authenticated;
grant select on asistencias.rate_limit_intento to authenticated;
grant all on asistencias.evento to service_role;
grant all on asistencias.asistencia to service_role;
grant all on asistencias.rate_limit_intento to service_role;
grant execute on function asistencias.distancia_metros(
  double precision,
  double precision,
  double precision,
  double precision
) to anon, authenticated, service_role;
