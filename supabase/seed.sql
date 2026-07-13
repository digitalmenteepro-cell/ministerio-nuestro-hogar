-- ============================================================================
--  05 · seed.sql — datos iniciales (idempotente)
--  Ejecutar DESPUÉS de storage.sql.
--
--  Solo carga catálogos base y la fila de configuración. NO crea usuarios ni
--  datos ficticios: eso lo haces tú desde la aplicación.
-- ============================================================================

-- Configuración global (fila única).
insert into public.ministry_settings (id, name, primary_color)
values (true, 'Ministerio de Alabanza Nuestro Hogar', '#590776')
on conflict (id) do nothing;

-- Catálogo de instrumentos.
insert into public.instruments (name)
values
  ('Voz principal'),
  ('Coros'),
  ('Guitarra acústica'),
  ('Guitarra eléctrica'),
  ('Bajo'),
  ('Batería'),
  ('Cajón'),
  ('Piano'),
  ('Teclado'),
  ('Sonido'),
  ('Multimedia'),
  ('Proyección')
on conflict (name) do nothing;

-- Verificación.
select
  (select count(*) from public.instruments)       as instrumentos,
  (select count(*) from public.ministry_settings) as configuracion;
