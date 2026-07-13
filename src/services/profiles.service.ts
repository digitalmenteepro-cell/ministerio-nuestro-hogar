import { requireSupabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types';

const SELECT = '*, instrument:instruments(id,name,active,created_at)';

export async function listProfiles(includeInactive = true): Promise<Profile[]> {
  const db = requireSupabase();
  let query = db.from('profiles').select(SELECT).order('first_name');
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const db = requireSupabase();
  const { data, error } = await db.from('profiles').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export type ProfileUpdate = Partial<
  Pick<Profile, 'first_name' | 'last_name' | 'phone' | 'instrument_id' | 'avatar_url' | 'role' | 'active'>
>;

export async function updateProfile(id: string, patch: ProfileUpdate): Promise<Profile> {
  const db = requireSupabase();
  const { data, error } = await db.from('profiles').update(patch).eq('id', id).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function setRole(id: string, role: Role): Promise<void> {
  await updateProfile(id, { role });
}

/** Soft-disable: keeps history intact, blocks access via RLS `active` checks. */
export async function setActive(id: string, active: boolean): Promise<void> {
  await updateProfile(id, { active });
}

/**
 * Deleting a user requires the service role, which must never live in the
 * browser. This calls the `admin-users` Edge Function, which verifies the
 * caller is an admin before using the service key server-side.
 */
export async function deleteUser(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.functions.invoke('admin-users', {
    body: { action: 'delete', user_id: id },
  });
  if (error) throw new Error(error.message);
}

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone?: string;
  instrument_id?: string | null;
}

/** Creates an auth user + profile through the secure Edge Function. */
export async function createUser(input: CreateUserInput): Promise<{ user_id: string }> {
  const db = requireSupabase();
  const { data, error } = await db.functions.invoke('admin-users', {
    body: { action: 'create', ...input },
  });
  if (error) throw new Error(error.message);
  return data as { user_id: string };
}
