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

  if (!appApiKey || !appId || !supabaseUrl || !supabaseAnonKey || !token) {
    return response.status(401).json({ error: 'No autorizado.' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return response.status(401).json({ error: 'No autorizado.' });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile?.active || profile.role !== 'admin') {
    return response.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
  }

  const payload = request.body as Partial<NotificationPayload> | undefined;
  if (
    !payload?.title?.trim() ||
    !payload.message?.trim() ||
    !payload.url ||
    !allowedUrls.has(payload.url)
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
        included_segments: ['Subscribed Users'],
        headings: { en: payload.title.trim(), es: payload.title.trim() },
        contents: { en: payload.message.trim(), es: payload.message.trim() },
        url: payload.url,
      }),
    });

    if (!oneSignalResponse.ok) {
      return response.status(502).json({ error: 'No se pudo enviar la notificación.' });
    }

    return response.status(200).json({ sent: true });
  } catch {
    return response.status(502).json({ error: 'No se pudo enviar la notificación.' });
  }
}
