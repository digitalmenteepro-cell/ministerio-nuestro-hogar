/**
 * Edge Function: admin-users
 * -------------------------------------------------------------------------
 * Crea y elimina usuarios de Supabase Auth. Estas operaciones exigen la
 * SERVICE_ROLE_KEY, que jamás puede vivir en el frontend: por eso se hacen aquí.
 *
 * Contrato (coincide con src/services/profiles.service.ts):
 *
 *   POST { action: "create", email, password, first_name, last_name,
 *          role, phone?, instrument_id? }   -> 200 { user_id }
 *   POST { action: "delete", user_id }      -> 200 { success: true }
 *
 * Seguridad: se valida el JWT de quien llama y se exige rol admin ANTES de
 * usar el cliente con service role (ver _shared/auth.ts).
 *
 * Despliegue:
 *   supabase functions deploy admin-users
 * SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY son inyectadas
 * automáticamente por la plataforma; no hace falta declararlas como secrets.
 */
import { HttpError, adminClient, requireAdmin } from '../_shared/auth.ts';
import { fail, handlePreflight, json } from '../_shared/cors.ts';

type Role = 'admin' | 'musician';

interface CreatePayload {
  action: 'create';
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone?: string;
  instrument_id?: string | null;
}

interface DeletePayload {
  action: 'delete';
  user_id: string;
}

type Payload = CreatePayload | DeletePayload;

function assertCreate(p: CreatePayload): void {
  const missing = (['email', 'password', 'first_name', 'last_name', 'role'] as const).filter(
    (k) => !p[k] || String(p[k]).trim() === '',
  );
  if (missing.length > 0) {
    throw new HttpError(`Faltan campos obligatorios: ${missing.join(', ')}.`, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    throw new HttpError('El correo no tiene un formato válido.', 400);
  }
  if (p.password.length < 8) {
    throw new HttpError('La contraseña debe tener al menos 8 caracteres.', 400);
  }
  if (p.role !== 'admin' && p.role !== 'musician') {
    throw new HttpError('El rol debe ser "admin" o "musician".', 400);
  }
}

async function createUser(payload: CreatePayload) {
  assertCreate(payload);
  const db = adminClient();

  // El trigger handle_new_user() crea la fila en `profiles` leyendo estos metadatos.
  const { data, error } = await db.auth.admin.createUser({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      role: payload.role,
      phone: payload.phone?.trim() ?? null,
    },
  });

  if (error) {
    const duplicate = /already|registered|exists/i.test(error.message);
    throw new HttpError(
      duplicate
        ? 'Ya existe un usuario registrado con ese correo.'
        : `No se pudo crear el usuario: ${error.message}`,
      duplicate ? 409 : 400,
    );
  }

  const userId = data.user!.id;

  // El instrumento no viaja en los metadatos del trigger: se asigna aquí.
  if (payload.instrument_id) {
    const { error: instrumentError } = await db
      .from('profiles')
      .update({ instrument_id: payload.instrument_id })
      .eq('id', userId);

    if (instrumentError) {
      // Rollback: no dejamos un usuario Auth a medio configurar.
      await db.auth.admin.deleteUser(userId);
      throw new HttpError(
        `No se pudo asignar el instrumento: ${instrumentError.message}`,
        400,
      );
    }
  }

  return json({ user_id: userId });
}

async function deleteUser(payload: DeletePayload, callerId: string) {
  if (!payload.user_id) {
    throw new HttpError('Falta el campo user_id.', 400);
  }
  if (payload.user_id === callerId) {
    throw new HttpError('No puedes eliminar tu propia cuenta de administrador.', 400);
  }

  const db = adminClient();

  // No dejar al ministerio sin ningún administrador.
  const { data: target } = await db
    .from('profiles')
    .select('role')
    .eq('id', payload.user_id)
    .maybeSingle();

  if (target?.role === 'admin') {
    const { count } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');

    if ((count ?? 0) <= 1) {
      throw new HttpError('No puedes eliminar al último administrador.', 400);
    }
  }

  // `profiles` tiene FK ON DELETE CASCADE contra auth.users: se limpia solo.
  const { error } = await db.auth.admin.deleteUser(payload.user_id);
  if (error) {
    throw new HttpError(`No se pudo eliminar el usuario: ${error.message}`, 400);
  }

  return json({ success: true });
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') {
      throw new HttpError('Método no permitido.', 405);
    }

    const caller = await requireAdmin(req);

    let payload: Payload;
    try {
      payload = (await req.json()) as Payload;
    } catch {
      throw new HttpError('El cuerpo de la petición no es JSON válido.', 400);
    }

    switch (payload.action) {
      case 'create':
        return await createUser(payload);
      case 'delete':
        return await deleteUser(payload, caller.id);
      default:
        throw new HttpError('Acción no reconocida. Usa "create" o "delete".', 400);
    }
  } catch (err) {
    if (err instanceof HttpError) return fail(err.message, err.status);
    console.error('admin-users:', err);
    return fail('Error interno de la función admin-users.', 500);
  }
});
