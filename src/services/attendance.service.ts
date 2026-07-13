import { requireSupabase } from '@/lib/supabase';
import type { Attendance, AttendanceStatus } from '@/types';

export async function listEventAttendance(eventId: string): Promise<Attendance[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('attendance')
    .select('*, profile:profiles(id,first_name,last_name,avatar_url)')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Attendance[];
}

export async function listMyAttendance(profileId: string): Promise<Attendance[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('attendance')
    .select('*, event:events(id,title,event_type,starts_at)')
    .eq('profile_id', profileId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Attendance[];
}

/** Upsert on (event_id, profile_id) — the table's composite primary key. */
export async function respondAttendance(
  eventId: string,
  profileId: string,
  status: AttendanceStatus,
  notes?: string,
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('attendance').upsert(
    { event_id: eventId, profile_id: profileId, status, notes: notes ?? null, responded_at: new Date().toISOString() },
    { onConflict: 'event_id,profile_id' },
  );
  if (error) throw new Error(error.message);
}

export interface AttendanceSummaryRow {
  profile_id: string;
  full_name: string;
  attending: number;
  not_attending: number;
  late: number;
  unable: number;
  total: number;
  rate: number;
}

export interface StatsFilters {
  from?: string;
  to?: string;
  event_type?: string;
}

/** Backed by the `attendance_summary_by_user` SQL function (see functions.sql). */
export async function attendanceByUser(filters: StatsFilters = {}): Promise<AttendanceSummaryRow[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('attendance_summary_by_user', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_event_type: filters.event_type ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceSummaryRow[];
}

export interface AttendanceByEventRow {
  event_id: string;
  title: string;
  event_type: string;
  starts_at: string;
  attending: number;
  not_attending: number;
  late: number;
  unable: number;
  no_response: number;
}

export async function attendanceByEvent(filters: StatsFilters = {}): Promise<AttendanceByEventRow[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('attendance_summary_by_event', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_event_type: filters.event_type ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceByEventRow[];
}

export interface DashboardStats {
  total_members: number;
  active_members: number;
  total_songs: number;
  upcoming_events: number;
  rehearsals: number;
  services: number;
  specials: number;
  attendance_rate: number;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('dashboard_stats');
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as DashboardStats;
}
