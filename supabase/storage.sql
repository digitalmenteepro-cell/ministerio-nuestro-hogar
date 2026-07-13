-- ============================================================================
--  04 · storage.sql — buckets y políticas de Storage
--  Ejecutar DESPUÉS de rls.sql (depende de is_admin() e is_active()).
--
--  Los límites de tamaño y MIME aquí deben coincidir con
--  src/services/storage.service.ts (MAX_FILE_BYTES / ACCEPTED_MIME).
-- ============================================================================

-- ------------------------------------------------------------- buckets ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars', 'avatars', true,
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'ministry-files', 'ministry-files', false,
    52428800, -- 50 MB
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/x-m4a'
    ]
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Idempotencia.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'nh_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- ------------------------------------------------------------- avatars ----
-- Bucket público: lectura libre (las fotos se muestran con getPublicUrl).
create policy "nh_avatars_read" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Solo puedes escribir dentro de tu carpeta: {auth.uid()}/archivo.jpg
create policy "nh_avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "nh_avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "nh_avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ------------------------------------------------------ ministry-files ----
-- Bucket privado: se accede mediante signed URLs. Todo integrante activo lee.
create policy "nh_files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'ministry-files' and public.is_active());

-- Subes solo a tu propia carpeta.
create policy "nh_files_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ministry-files'
    and public.is_active()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "nh_files_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ministry-files'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Borras lo tuyo; el admin borra cualquier archivo.
create policy "nh_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ministry-files'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
