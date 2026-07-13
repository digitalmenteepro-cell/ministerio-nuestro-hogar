/**
 * Edge Function: send-notification
 * -------------------------------------------------------------------------
 * Envía un anuncio por uno o varios canales (push / email / whatsapp) y deja
 * constancia de CADA intento en la tabla `notification_logs`.
 *
 * Contrato (coincide con src/services/announcements.service.ts):
 *
 *   POST { channels: ("push"|"email"|"whatsapp")[],
 *          subject: string,
 *          body: string,
 *          announcement_id?: string,
 *          recipient_ids?: string[] }        -> 200 { queued: number }
 *
 *   `recipient_ids` vacío u omitido = todos los integrantes activos.
 *   `queued` = número de registros escritos en notification_logs.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANTE — CREDENCIALES EXTERNAS
 * ---------------------------------------------------------------------------
 * El envío REAL depende de proveedores externos. Esta función implementa la
 * integración con Resend (email) y WhatsApp Cloud API, pero SOLO envía de
 * verdad si los secrets correspondientes están configurados:
 *
 *   supabase secrets set RESEND_API_KEY=...      NOTIFY_FROM_EMAIL=...
 *   supabase secrets set WHATSAPP_TOKEN=...      WHATSAPP_PHONE_ID=...
 *
 * Si un canal no tiene credenciales, NO se simula un envío exitoso: el intento
 * se registra con status = 'failed' y el motivo exacto en la columna `error`,
 * visible en el historial de la pantalla de Anuncios.
 *
 * El canal `push` requiere además registrar tokens de dispositivo (Web Push /
 * FCM), algo que la app todavía no hace: por eso queda declarado como pendiente
 * y se registra como 'failed' con el motivo correspondiente.
 *
 * Despliegue:
 *   supabase functions deploy send-notification
 */
import { HttpError, adminClient, requireAdmin } from '../_shared/auth.ts';
import { fail, handlePreflight, json } from '../_shared/cors.ts';

type Channel = 'push' | 'email' | 'whatsapp';
type Status = 'pending' | 'sent' | 'failed';

interface Payload {
  channels: Channel[];
  subject: string;
  body: string;
  announcement_id?: string;
  recipient_ids?: string[];
}

interface Recipient {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface LogRow {
  channel: Channel;
  recipient: string | null;
  subject: string | null;
  body: string;
  status: Status;
  error: string | null;
  announcement_id: string | null;
  sent_at: string | null;
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_FROM_EMAIL = Deno.env.get('NOTIFY_FROM_EMAIL') ?? '';
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? '';
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') ?? '';

const VALID_CHANNELS: Channel[] = ['push', 'email', 'whatsapp'];

/** Resultado de un intento de envío individual. */
interface Attempt {
  status: Status;
  error: string | null;
}

const ok = (): Attempt => ({ status: 'sent', error: null });
const ko = (error: string): Attempt => ({ status: 'failed', error });

/* -------------------------------------------------------------------------- */
/* Proveedores                                                                 */
/* -------------------------------------------------------------------------- */

async function sendEmail(to: string, subject: string, body: string): Promise<Attempt> {
  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL) {
    return ko(
      'Credenciales de email no configuradas (faltan los secrets RESEND_API_KEY y/o NOTIFY_FROM_EMAIL).',
    );
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM_EMAIL,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return ko(`Resend respondió ${res.status}: ${detail.slice(0, 300)}`);
    }
    return ok();
  } catch (err) {
    return ko(`Error de red al llamar a Resend: ${String(err).slice(0, 300)}`);
  }
}

async function sendWhatsapp(to: string, subject: string, body: string): Promise<Attempt> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return ko(
      'Credenciales de WhatsApp no configuradas (faltan los secrets WHATSAPP_TOKEN y/o WHATSAPP_PHONE_ID).',
    );
  }

  // Los números deben ir en formato internacional sin "+" ni separadores.
  const normalized = to.replace(/[^\d]/g, '');
  if (normalized.length < 8) {
    return ko(`El teléfono "${to}" no es un número válido en formato internacional.`);
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalized,
          type: 'text',
          text: { body: `*${subject}*\n\n${body}` },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      return ko(`WhatsApp Cloud API respondió ${res.status}: ${detail.slice(0, 300)}`);
    }
    return ok();
  } catch (err) {
    return ko(`Error de red al llamar a WhatsApp Cloud API: ${String(err).slice(0, 300)}`);
  }
}

function sendPush(): Attempt {
  // Pendiente: requiere que la app registre tokens de dispositivo (Web Push/FCM)
  // y una tabla `push_subscriptions`. Nada de esto existe todavía, así que no
  // se finge un envío correcto.
  return ko(
    'Canal push no disponible: la app aún no registra suscripciones de dispositivo (Web Push/FCM).',
  );
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                     */
/* -------------------------------------------------------------------------- */

function validate(payload: Payload): void {
  if (!Array.isArray(payload.channels) || payload.channels.length === 0) {
    throw new HttpError('Debes indicar al menos un canal de envío.', 400);
  }
  const unknown = payload.channels.filter((c) => !VALID_CHANNELS.includes(c));
  if (unknown.length > 0) {
    throw new HttpError(`Canal no soportado: ${unknown.join(', ')}.`, 400);
  }
  if (!payload.body || payload.body.trim() === '') {
    throw new HttpError('El mensaje no puede estar vacío.', 400);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') {
      throw new HttpError('Método no permitido.', 405);
    }

    await requireAdmin(req);

    let payload: Payload;
    try {
      payload = (await req.json()) as Payload;
    } catch {
      throw new HttpError('El cuerpo de la petición no es JSON válido.', 400);
    }
    validate(payload);

    const db = adminClient();
    const subject = (payload.subject ?? '').trim();
    const body = payload.body.trim();

    // Destinatarios: los indicados, o todos los integrantes activos.
    let query = db
      .from('profiles')
      .select('id, email, phone, first_name, last_name')
      .eq('active', true);

    if (payload.recipient_ids && payload.recipient_ids.length > 0) {
      query = query.in('id', payload.recipient_ids);
    }

    const { data: recipients, error: recipientsError } = await query;
    if (recipientsError) {
      throw new HttpError(
        `No se pudieron obtener los destinatarios: ${recipientsError.message}`,
        500,
      );
    }
    if (!recipients || recipients.length === 0) {
      throw new HttpError('No hay integrantes activos que coincidan con la selección.', 400);
    }

    const logs: LogRow[] = [];

    for (const person of recipients as Recipient[]) {
      for (const channel of payload.channels) {
        let target: string | null = null;
        let attempt: Attempt;

        if (channel === 'email') {
          target = person.email;
          attempt = target
            ? await sendEmail(target, subject, body)
            : ko('El integrante no tiene correo registrado.');
        } else if (channel === 'whatsapp') {
          target = person.phone;
          attempt = target
            ? await sendWhatsapp(target, subject, body)
            : ko('El integrante no tiene teléfono registrado.');
        } else {
          target = person.id;
          attempt = sendPush();
        }

        logs.push({
          channel,
          recipient: target,
          subject: subject || null,
          body,
          status: attempt.status,
          error: attempt.error,
          announcement_id: payload.announcement_id ?? null,
          sent_at: attempt.status === 'sent' ? new Date().toISOString() : null,
        });
      }
    }

    const { error: logError } = await db.from('notification_logs').insert(logs);
    if (logError) {
      throw new HttpError(
        `Los envíos se procesaron pero no se pudo escribir el historial: ${logError.message}`,
        500,
      );
    }

    const sent = logs.filter((l) => l.status === 'sent').length;
    const failed = logs.length - sent;

    return json({ queued: logs.length, sent, failed });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.message, err.status);
    console.error('send-notification:', err);
    return fail('Error interno de la función send-notification.', 500);
  }
});
