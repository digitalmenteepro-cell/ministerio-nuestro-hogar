import { requireSupabase } from '@/lib/supabase';

export interface PushNotificationInput {
  title: string;
  message: string;
  url: string;
}

export async function sendPushNotification(input: PushNotificationInput): Promise<void> {
  const { data } = await requireSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('La sesión ha caducado. Vuelve a iniciar sesión.');

  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? 'No se pudo enviar la notificación.');
  }
}
