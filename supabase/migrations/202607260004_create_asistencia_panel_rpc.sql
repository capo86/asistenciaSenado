create or replace function public.asistencias_list_panel(p_evento_id uuid)
returns setof asistencias.asistencia
language sql
security definer
set search_path = asistencias, public
as $$
  select *
  from asistencias.asistencia
  where evento_id = p_evento_id
  order by creado_en desc;
$$;

grant execute on function public.asistencias_list_panel(uuid)
  to service_role;
