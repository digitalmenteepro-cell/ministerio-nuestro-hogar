import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Env vars that are missing or still hold placeholder values. */
export const missingEnvVars: string[] = [
  !url || url.includes('TU-PROYECTO') ? 'VITE_SUPABASE_URL' : null,
  !anonKey || anonKey.includes('TU_ANON_KEY') ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter((v): v is string => v !== null);

export const isSupabaseConfigured = missingEnvVars.length === 0;

/**
 * Null when env vars are absent, so the app can render a clear
 * configuration screen instead of crashing at import time.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'nuestro-hogar-auth',
      },
    })
  : null;

/** Narrows the nullable client; throws a readable error if unconfigured. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      `Supabase no está configurado. Faltan variables de entorno: ${missingEnvVars.join(', ')}. Copia .env.example a .env y reinicia el servidor.`,
    );
  }

  return supabase;
}