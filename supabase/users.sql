-- ============================================================================
--  06 · users.sql — ADMINISTRADOR INICIAL (Gustavo)
--  Ejecutar AL FINAL, después de crear la cuenta en Authentication > Users.
-- ============================================================================
--
--  IMPORTANTE
--  ----------
--  No se puede crear un usuario de auth.users desde SQL de forma soportada.
--  El flujo correcto es:
--
--    1. Supabase Dashboard → Authentication → Users → "Add user"
--       → "Create new user".
--    2. Ingresa el correo REAL de Gustavo y una contraseña temporal.
--    3. Marca "Auto Confirm User" (si no, no podrá iniciar sesión).
--    4. El trigger on_auth_user_created (functions.sql) crea su perfil
--       automáticamente con rol 'musician'.
--    5. Reemplaza el marcador de abajo por su correo y ejecuta este script
--       para promoverlo a administrador.
--
--  >>> REEMPLAZA ESTE VALOR ANTES DE EJECUTAR <<<
--  No inventamos el correo de Gustavo: debes ponerlo tú.
-- ============================================================================

do $$
declare
  -- ┌──────────────────────────────────────────────────────────────────┐
  -- │  CAMBIA ESTA LÍNEA por el correo real de Gustavo                 │
  -- └──────────────────────────────────────────────────────────────────┘
  admin_email text := 'REEMPLAZAR_POR_CORREO_DE_GUSTAVO';

  target_id uuid;
begin
  if admin_email = 'REEMPLAZAR_POR_CORREO_DE_GUSTAVO' then
    raise exception
      'Debes reemplazar REEMPLAZAR_POR_CORREO_DE_GUSTAVO por el correo real de Gustavo antes de ejecutar este script.';
  end if;

  -- El usuario debe existir ya en auth.users (paso 1-3 de arriba).
  select id into target_id
  from auth.users
  where lower(email) = lower(admin_email);

  if target_id is null then
    raise exception
      'No existe un usuario en auth.users con el correo %. Créalo primero en Authentication > Users.',
      admin_email;
  end if;

  -- Red de seguridad: si el trigger no hubiera corrido, insertamos el perfil.
  insert into public.profiles (id, first_name, last_name, email, role, active)
  values (target_id, 'Gustavo', '', admin_email, 'admin', true)
  on conflict (id) do update
    set role       = 'admin',
        active     = true,
        first_name = coalesce(nullif(public.profiles.first_name, ''), 'Gustavo');

  raise notice 'Gustavo (%) quedó como ADMINISTRADOR. id = %', admin_email, target_id;
end $$;

-- Verificación: debe devolver exactamente una fila con role = admin.
select id, first_name, last_name, email, role, active
from public.profiles
where role = 'admin';
