import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Utilidades de autenticación para las Edge Functions.
 *
 * REGLA DE ORO: la SERVICE_ROLE_KEY nunca se expone al frontend y sólo se usa
 * DESPUÉS de haber verificado, con el JWT del propio usuario, que quien llama
 * es un administrador activo. De lo contrario cualquier músico autenticado
 * podría crear o borrar usuarios.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Cliente con privilegios totales. Sólo para uso interno del servidor. */
export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new HttpError(
      'Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en la función.',
      500,
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Caller {
  id: string;
  email: string | null;
  role: 'admin' | 'musician';
  active: boolean;
}

/**
 * Resuelve el usuario que hace la petición a partir del header Authorization
 * y lee su fila en `profiles` (role/active). Lanza HttpError si el token es
 * inválido, si no hay perfil o si la cuenta está desactivada.
 */
export async function getCaller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new HttpError('Falta el token de autenticación.', 401);
  }

  // Cliente "como el usuario": valida la firma del JWT contra Supabase Auth.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    throw new HttpError('Token inválido o expirado.', 401);
  }
  const user = userData.user;

  // El rol se lee con service role para no depender de las RLS de lectura.
  const { data: profile, error: profileError } = await adminClient()
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(`No se pudo leer el perfil: ${profileError.message}`, 500);
  }
  if (!profile) {
    throw new HttpError('El usuario no tiene un perfil asociado.', 403);
  }
  if (!profile.active) {
    throw new HttpError('La cuenta está desactivada.', 403);
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role: profile.role as Caller['role'],
    active: profile.active as boolean,
  };
}

/** Igual que getCaller, pero además exige rol admin. */
export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await getCaller(req);
  if (caller.role !== 'admin') {
    throw new HttpError('Solo un administrador puede realizar esta acción.', 403);
  }
  return caller;
}
