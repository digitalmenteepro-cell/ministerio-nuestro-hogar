/**
 * Cabeceras CORS compartidas por las Edge Functions.
 *
 * En producción conviene reemplazar "*" por el dominio real de la app
 * (por ejemplo https://nuestro-hogar.vercel.app) usando la variable
 * de entorno APP_ORIGIN.
 */
const allowedOrigin = Deno.env.get('APP_ORIGIN') ?? '*';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Respuesta JSON con CORS ya aplicado. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Respuesta de error homogénea: { error: "mensaje" }. */
export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Maneja el preflight OPTIONS. Devuelve null si no aplica. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
