import { requireSupabase } from '@/lib/supabase';
import type { Instrument } from '@/types';

export async function listInstruments(): Promise<Instrument[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('instruments').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Instrument[];
}

export async function createInstrument(name: string): Promise<Instrument> {
  const db = requireSupabase();
  const { data, error } = await db.from('instruments').insert({ name }).select().single();
  if (error) throw new Error(error.message);
  return data as Instrument;
}

export async function updateInstrument(id: string, patch: Partial<Pick<Instrument, 'name' | 'active'>>): Promise<Instrument> {
  const db = requireSupabase();
  const { data, error } = await db.from('instruments').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as Instrument;
}

export async function deleteInstrument(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('instruments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
