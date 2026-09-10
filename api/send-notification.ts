import { createClient } from '@supabase/supabase-js';

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
}

interface NotificationPayload {
  title: string;
  message: string;
  url: string;
}

const allowedUrls = new Set([
  'https://ministerio-nuestro-hogar.vercel.app/anuncios',
  'https://ministerio-nuestro-hogar.vercel.app/calendario',
  'https://ministerio-nuestro-hogar.vercel.app/repertorio',
]);

const eventUrlPattern = /^\/calendario\?event=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedUrl(value: string): boolean {
  if (allowedUrls.has(value) || eventUrlPattern.test(value)) return true;

  try {
    const url = new URL(value);
    return (
      url.origin === 'https://ministerio-nuestro-hogar.vercel.app' &&
      url.pathname === '/calendario' &&
      url.searchParams.size === 1 &&
      url.searchParams.has('event') &&
      eventUrlPattern.test(`${url.pathname}${url.search}`)
    );
  } catch {
    return false;
  }
}

function getBearerToken(request: VercelRequest): string | null {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const appApiKey = process.env.ONESIGNAL_APP_API_KEY;
  const appId = process.env.ONESIGNAL_APP_ID;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const token = getBearerToken(request);

  if (!appApiKey || !appId) {
    return response.status(500).json({ error: 'La configuración de OneSignal está incompleta.' });
  }

  if (appId !== 'e74c71ae-1d2d-46f8-9c89-e510ae4d8aef') {
    return response.status(500).json({ error: 'El App ID de OneSignal no coincide con la aplicación configurada.' });
  }

  if (!supabaseUrl || !supabaseAnonKey || !token) {
    return response.status(401).json({ error: 'No autorizado.' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return response.status(401).json({ error: 'No autorizado.' });
  }

  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('id, role, active')
    .eq('id', authData.user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin' && profile.active === true;
  console.log('[push auth]', {
    authenticated: true,
    userId: authData.user.id,
    profileFound: Boolean(profile),
    profileQueryFailed: Boolean(profileError),
    resolvedRole: profile?.role ?? null,
    active: profile?.active ?? null,
    isAdmin,
  });

  if (profileError || !isAdmin) {
    return response.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
  }

  const payload = request.body as Partial<NotificationPayload> | undefined;
  if (
    !payload?.title?.trim() ||
    !payload.message?.trim() ||
    !payload.url ||
    !isAllowedUrl(payload.url)
  ) {
    return response.status(400).json({ error: 'Datos de notificación inválidos.' });
  }

  try {
    const oneSignalResponse = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Key ${appApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        included_segments: ['Total Subscriptions'],
        headings: { en: payload.title.trim(), es: payload.title.trim() },
        contents: { en: payload.message.trim(), es: payload.message.trim() },
        url: payload.url,
      }),
    });

    const responseText = await oneSignalResponse.text();
    let parsedResponse: {
      id?: string;
      recipients?: number | null;
      errors?: unknown;
      [key: string]: unknown;
    } | null = null;

    try {
      parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsedResponse = null;
    }

    console.log('[onesignal response]', {
      status: oneSignalResponse.status,
      ok: oneSignalResponse.ok,
      hasId: Boolean(parsedResponse?.id),
      id: parsedResponse?.id ?? null,
      recipients: parsedResponse?.recipients ?? null,
      errors: parsedResponse?.errors ?? null,
    });

    if (!oneSignalResponse.ok) {
      const providerMessage =
        typeof parsedResponse?.errors === 'string'
          ? parsedResponse.errors
          : 'OneSignal rechazó la solicitud.';
      return response.status(502).json({
        error: 'No se pudo crear la notificación en OneSignal.',
        details: providerMessage,
      });
    }

    if (!parsedResponse?.id) {
      return response.status(502).json({
        error: 'OneSignal respondió correctamente, pero no creó ningún mensaje.',
      });
    }

    return response.status(200).json({ success: true, id: parsedResponse.id });
  } catch {
    return response.status(502).json({ error: 'No se pudo enviar la notificación.' });
  }
}
