import { requireSupabase } from '@/lib/supabase';
import type { MinistrySettings } from '@/types';

export async function getSettings(): Promise<MinistrySettings | null> {
  const db = requireSupabase();
  const { data, error } = await db.from('ministry_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MinistrySettings) ?? null;
}

export async function updateSettings(patch: Partial<MinistrySettings>): Promise<MinistrySettings> {
  const db = requireSupabase();
  const { data, error } = await db.from('ministry_settings').update(patch).eq('id', true).select().single();
  if (error) throw new Error(error.message);
  return data as MinistrySettings;
}
