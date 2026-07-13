import { requireSupabase } from '@/lib/supabase';
import type { Announcement, NotificationChannel, NotificationLog } from '@/types';

export async function listAnnouncements(onlyPublished = false): Promise<Announcement[]> {
  const db = requireSupabase();
  let query = db.from('announcements').select('*').order('created_at', { ascending: false });
  if (onlyPublished) query = query.eq('published', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

export async function createAnnouncement(
  input: Pick<Announcement, 'title' | 'body' | 'published'>,
  createdBy: string,
): Promise<Announcement> {
  const db = requireSupabase();
  const { data, error } = await db.from('announcements').insert({ ...input, created_by: createdBy }).select().single();
  if (error) throw new Error(error.message);
  return data as Announcement;
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<Pick<Announcement, 'title' | 'body' | 'published'>>,
): Promise<Announcement> {
  const db = requireSupabase();
  const { data, error } = await db.from('announcements').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('announcements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ---------------- Notifications ---------------- */

export interface SendNotificationInput {
  channels: NotificationChannel[];
  subject: string;
  body: string;
  announcement_id?: string;
  /** Empty array = every active member. */
  recipient_ids?: string[];
}

/**
 * Delegates to the `send-notification` Edge Function. Provider credentials
 * (push/email/WhatsApp) live server-side as Supabase secrets, never here.
 * Every attempt is written to `notification_logs`, including failures.
 */
export async function sendNotification(input: SendNotificationInput): Promise<{ queued: number }> {
  const db = requireSupabase();
  const { data, error } = await db.functions.invoke('send-notification', { body: input });
  if (error) throw new Error(error.message);
  return data as { queued: number };
}

export async function listNotificationLogs(limit = 50): Promise<NotificationLog[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('notification_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationLog[];
}
