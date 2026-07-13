-- ============================================================================
--  02 · functions.sql — funciones, triggers y RPC de estadísticas
--  Ejecutar DESPUÉS de schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  is_admin()
--  Usada por TODAS las políticas RLS. SECURITY DEFINER para poder leer
--  profiles sin caer en recursión de políticas sobre la misma tabla.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- ---------------------------------------------------------------------------
--  is_active()
--  Un usuario desactivado no debe poder leer ni escribir nada.
-- ---------------------------------------------------------------------------
create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
  );
$$;

-- ---------------------------------------------------------------------------
--  handle_new_user()
--  Crea el perfil automáticamente al registrarse en auth.users.
--  El rol viene de raw_user_meta_data (lo envía la Edge Function admin-users).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'admin'
        then 'admin'::public.app_role
      else 'musician'::public.app_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
--  set_updated_at()
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists songs_updated on public.songs;
create trigger songs_updated
  before update on public.songs
  for each row execute function public.set_updated_at();

drop trigger if exists events_updated on public.events;
create trigger events_updated
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists settings_updated on public.ministry_settings;
create trigger settings_updated
  before update on public.ministry_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
--  protect_privileged_profile_columns()
--  Blindaje real: aunque un músico logre un UPDATE sobre su propia fila,
--  NO puede modificar role, active ni email. Solo un admin puede.
--  Esto cierra el hueco de escalada de privilegios que una política
--  "self update" por sí sola dejaría abierto.
-- ---------------------------------------------------------------------------
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No puedes cambiar tu propio rol.' using errcode = '42501';
  end if;

  if new.active is distinct from old.active then
    raise exception 'No puedes cambiar tu estado de activación.' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'No puedes cambiar tu correo.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();

-- ---------------------------------------------------------------------------
--  dashboard_stats()
--  Consumida por src/services/attendance.service.ts → dashboardStats()
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns table (
  total_members   integer,
  active_members  integer,
  total_songs     integer,
  upcoming_events integer,
  rehearsals      integer,
  services        integer,
  specials        integer,
  attendance_rate numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profiles where active),
    (select count(*)::integer from public.songs),
    (select count(*)::integer from public.events where starts_at >= now()),
    (select count(*)::integer from public.events where event_type = 'rehearsal'),
    (select count(*)::integer from public.events where event_type = 'service'),
    (select count(*)::integer from public.events where event_type = 'special'),
    coalesce((
      select round(
        100.0 * count(*) filter (where status in ('attending', 'late'))
        / nullif(count(*), 0)
      , 1)
      from public.attendance
    ), 0)::numeric;
$$;

-- ---------------------------------------------------------------------------
--  attendance_summary_by_user(p_from, p_to, p_event_type)
--  Estadísticas por usuario y periodo. Solo admins (ver rls.sql / revoke).
-- ---------------------------------------------------------------------------
create or replace function public.attendance_summary_by_user(
  p_from       date default null,
  p_to         date default null,
  p_event_type text default null
)
returns table (
  profile_id    uuid,
  full_name     text,
  attending     integer,
  not_attending integer,
  late          integer,
  unable        integer,
  total         integer,
  rate          numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    btrim(p.first_name || ' ' || p.last_name) as full_name,
    count(*) filter (where a.status = 'attending')::integer,
    count(*) filter (where a.status = 'not_attending')::integer,
    count(*) filter (where a.status = 'late')::integer,
    count(*) filter (where a.status = 'unable')::integer,
    count(a.*)::integer,
    coalesce(round(
      100.0 * count(*) filter (where a.status in ('attending', 'late'))
      / nullif(count(a.*), 0)
    , 1), 0)::numeric
  from public.profiles p
  left join public.attendance a on a.profile_id = p.id
  left join public.events e     on e.id = a.event_id
   and (p_from       is null or e.starts_at >= p_from::timestamptz)
   and (p_to         is null or e.starts_at <  (p_to::timestamptz + interval '1 day'))
   and (p_event_type is null or e.event_type = p_event_type::public.event_type)
  where p.active
  group by p.id, p.first_name, p.last_name
  order by full_name;
$$;

-- ---------------------------------------------------------------------------
--  attendance_summary_by_event(p_from, p_to, p_event_type)
-- ---------------------------------------------------------------------------
create or replace function public.attendance_summary_by_event(
  p_from       date default null,
  p_to         date default null,
  p_event_type text default null
)
returns table (
  event_id      uuid,
  title         text,
  event_type    text,
  starts_at     timestamptz,
  attending     integer,
  not_attending integer,
  late          integer,
  unable        integer,
  no_response   integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.id,
    e.title,
    e.event_type::text,
    e.starts_at,
    count(*) filter (where a.status = 'attending')::integer,
    count(*) filter (where a.status = 'not_attending')::integer,
    count(*) filter (where a.status = 'late')::integer,
    count(*) filter (where a.status = 'unable')::integer,
    greatest(
      (select count(*) from public.profiles where active)::integer - count(a.*)::integer,
      0
    )
  from public.events e
  left join public.attendance a on a.event_id = e.id
  where (p_from       is null or e.starts_at >= p_from::timestamptz)
    and (p_to         is null or e.starts_at <  (p_to::timestamptz + interval '1 day'))
    and (p_event_type is null or e.event_type = p_event_type::public.event_type)
  group by e.id, e.title, e.event_type, e.starts_at
  order by e.starts_at desc;
$$;

-- ---------------------------------------------------------------------------
--  Permisos de ejecución
--  security invoker + RLS activo = las funciones respetan las políticas.
-- ---------------------------------------------------------------------------
grant execute on function public.dashboard_stats()                        to authenticated;
grant execute on function public.attendance_summary_by_user(date, date, text)  to authenticated;
grant execute on function public.attendance_summary_by_event(date, date, text) to authenticated;
