-- ============================================================================
--  03 · rls.sql — Row Level Security y políticas
--  Ejecutar DESPUÉS de functions.sql (depende de is_admin() e is_active()).
--
--  PRINCIPIO: ocultar botones en el frontend NO es seguridad. Estas políticas
--  son la frontera real. Un músico que llame a la API directamente con su
--  anon key sigue sin poder escribir donde no le corresponde.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.instruments       enable row level security;
alter table public.songs             enable row level security;
alter table public.events            enable row level security;
alter table public.event_songs       enable row level security;
alter table public.attendance        enable row level security;
alter table public.files             enable row level security;
alter table public.announcements     enable row level security;
alter table public.notification_logs enable row level security;
alter table public.ministry_settings enable row level security;

-- Idempotencia: limpiar políticas previas de estas tablas.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','instruments','songs','events','event_songs','attendance',
        'files','announcements','notification_logs','ministry_settings'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------- profiles ----
-- Lectura: cualquier integrante activo ve el directorio del equipo.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (public.is_active());

-- Un usuario actualiza SOLO su propia fila. El trigger
-- protect_privileged_profile_columns() impide que toque role/active/email.
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El admin puede todo sobre cualquier perfil.
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------- instruments ----
create policy "instruments_select" on public.instruments
  for select to authenticated
  using (public.is_active());

create policy "instruments_admin_all" on public.instruments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------- songs ----
create policy "songs_select" on public.songs
  for select to authenticated
  using (public.is_active());

create policy "songs_admin_all" on public.songs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --------------------------------------------------------------- events ----
create policy "events_select" on public.events
  for select to authenticated
  using (public.is_active());

create policy "events_admin_all" on public.events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------- event_songs ----
create policy "event_songs_select" on public.event_songs
  for select to authenticated
  using (public.is_active());

create policy "event_songs_admin_all" on public.event_songs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------- attendance ----
-- Cada quien ve su propia asistencia; el admin ve la de todos.
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (public.is_active() and (profile_id = auth.uid() or public.is_admin()));

-- Un músico SOLO puede responder por sí mismo (profile_id = auth.uid()).
create policy "attendance_insert_self" on public.attendance
  for insert to authenticated
  with check (public.is_active() and (profile_id = auth.uid() or public.is_admin()));

create policy "attendance_update_self" on public.attendance
  for update to authenticated
  using (public.is_active() and (profile_id = auth.uid() or public.is_admin()))
  with check (public.is_active() and (profile_id = auth.uid() or public.is_admin()));

create policy "attendance_delete" on public.attendance
  for delete to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- files ----
-- Los archivos del ministerio son compartidos: todo integrante activo los ve.
create policy "files_select" on public.files
  for select to authenticated
  using (public.is_active());

-- Solo puedes registrar archivos a tu propio nombre.
create policy "files_insert_own" on public.files
  for insert to authenticated
  with check (public.is_active() and owner_id = auth.uid());

-- Borras lo tuyo; el admin borra cualquiera.
create policy "files_delete" on public.files
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "files_update_admin" on public.files
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------------------------------------- announcements ----
-- Los músicos ven solo los publicados; el admin ve también los borradores.
create policy "announcements_select" on public.announcements
  for select to authenticated
  using (public.is_active() and (published or public.is_admin()));

create policy "announcements_admin_all" on public.announcements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------- notification_logs ----
-- El historial de envíos es solo para administradores.
create policy "notification_logs_admin_select" on public.notification_logs
  for select to authenticated
  using (public.is_admin());

-- La escritura la hace la Edge Function con service role (que ignora RLS).
create policy "notification_logs_admin_all" on public.notification_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------- ministry_settings ----
create policy "settings_select" on public.ministry_settings
  for select to authenticated
  using (public.is_active());

create policy "settings_admin_all" on public.ministry_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
