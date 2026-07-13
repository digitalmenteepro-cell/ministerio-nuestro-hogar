import { requireSupabase } from '@/lib/supabase';
import type { EventSong, EventType, MinistryEvent } from '@/types';

const SELECT = '*, responsible:profiles!events_responsible_id_fkey(id,first_name,last_name)';

export interface EventFilters {
  from?: string;
  to?: string;
  type?: EventType;
}

export async function listEvents(filters: EventFilters = {}): Promise<MinistryEvent[]> {
  const db = requireSupabase();
  let query = db.from('events').select(SELECT).order('starts_at', { ascending: true });
  if (filters.from) query = query.gte('starts_at', filters.from);
  if (filters.to) query = query.lte('starts_at', filters.to);
  if (filters.type) query = query.eq('event_type', filters.type);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MinistryEvent[];
}

export async function listUpcomingEvents(limit = 5): Promise<MinistryEvent[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('events')
    .select(SELECT)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MinistryEvent[];
}

export async function getEvent(id: string): Promise<MinistryEvent | null> {
  const db = requireSupabase();
  const { data, error } = await db.from('events').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MinistryEvent) ?? null;
}

export type EventInput = Omit<
  MinistryEvent,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'responsible'
>;

export async function createEvent(input: EventInput, createdBy: string): Promise<MinistryEvent> {
  const db = requireSupabase();
  const { data, error } = await db.from('events').insert({ ...input, created_by: createdBy }).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as MinistryEvent;
}

export async function updateEvent(id: string, patch: Partial<EventInput>): Promise<MinistryEvent> {
  const db = requireSupabase();
  const { data, error } = await db.from('events').update(patch).eq('id', id).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as MinistryEvent;
}

export async function deleteEvent(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ---------- Setlist (songs attached to an event) ---------- */

export async function listEventSongs(eventId: string): Promise<EventSong[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('event_songs')
    .select('*, song:songs(*)')
    .eq('event_id', eventId)
    .order('position');
  if (error) throw new Error(error.message);
  return (data ?? []) as EventSong[];
}

export async function addSongToEvent(eventId: string, songId: string, position: number): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('event_songs').insert({ event_id: eventId, song_id: songId, position });
  if (error) throw new Error(error.message);
}

export async function removeSongFromEvent(eventId: string, songId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('event_songs').delete().eq('event_id', eventId).eq('song_id', songId);
  if (error) throw new Error(error.message);
}

export async function reorderEventSong(eventId: string, songId: string, position: number): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('event_songs')
    .update({ position })
    .eq('event_id', eventId)
    .eq('song_id', songId);
  if (error) throw new Error(error.message);
}
