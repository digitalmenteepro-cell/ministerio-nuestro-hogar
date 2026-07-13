import { requireSupabase } from '@/lib/supabase';
import type { Song } from '@/types';

export type SongInput = Omit<Song, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export async function listSongs(search = ''): Promise<Song[]> {
  const db = requireSupabase();
  let query = db.from('songs').select('*').order('title');
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},author.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Song[];
}

export async function getSong(id: string): Promise<Song | null> {
  const db = requireSupabase();
  const { data, error } = await db.from('songs').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Song) ?? null;
}

export async function createSong(input: SongInput, createdBy: string): Promise<Song> {
  const db = requireSupabase();
  const { data, error } = await db.from('songs').insert({ ...input, created_by: createdBy }).select().single();
  if (error) throw new Error(error.message);
  return data as Song;
}

export async function updateSong(id: string, patch: Partial<SongInput>): Promise<Song> {
  const db = requireSupabase();
  const { data, error } = await db.from('songs').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as Song;
}

export async function deleteSong(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('songs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
