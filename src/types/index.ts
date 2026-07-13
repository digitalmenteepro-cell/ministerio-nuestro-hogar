export type Role = 'admin' | 'musician';
export type EventType = 'rehearsal' | 'service' | 'special';
export type AttendanceStatus = 'attending' | 'not_attending' | 'late' | 'unable';
export type FileCategory = 'pdf' | 'word' | 'image' | 'audio' | 'score' | 'other';
export type NotificationChannel = 'push' | 'email' | 'whatsapp';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Instrument {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  instrument_id: string | null;
  role: Role;
  active: boolean;
  joined_at: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  instrument?: Instrument | null;
}

export interface Song {
  id: string;
  title: string;
  author: string | null;
  song_key: string | null;
  bpm: number | null;
  duration_seconds: number | null;
  capo: string | null;
  version: string | null;
  notes: string | null;
  lyrics: string | null;
  spotify_url: string | null;
  youtube_url: string | null;
  pdf_path: string | null;
  score_path: string | null;
  audio_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MinistryEvent {
  id: string;
  title: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  description: string | null;
  responsible_id: string | null;
  service_type: string | null;
  preacher: string | null;
  observations: string | null;
  special_category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  responsible?: Pick<Profile, 'id' | 'first_name' | 'last_name'> | null;
}

export interface EventSong {
  event_id: string;
  song_id: string;
  position: number;
  notes: string | null;
  song?: Song;
}

export interface Attendance {
  event_id: string;
  profile_id: string;
  status: AttendanceStatus;
  notes: string | null;
  responded_at: string;
  profile?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'avatar_url'>;
  event?: Pick<MinistryEvent, 'id' | 'title' | 'event_type' | 'starts_at'>;
}

export interface MinistryFile {
  id: string;
  owner_id: string | null;
  name: string;
  path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: FileCategory;
  created_at: string;
  owner?: Pick<Profile, 'id' | 'first_name' | 'last_name'> | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  channel: NotificationChannel;
  recipient: string | null;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  error: string | null;
  announcement_id: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface MinistrySettings {
  id: boolean;
  name: string;
  logo_url: string | null;
  primary_color: string;
  address: string | null;
  phones: string[] | null;
  schedule: string | null;
  socials: Record<string, string>;
  notifications_enabled: Record<NotificationChannel, boolean>;
  updated_at: string;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  rehearsal: 'Ensayo',
  service: 'Culto',
  special: 'Evento especial',
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  attending: 'Asistiré',
  not_attending: 'No asistiré',
  late: 'Llegaré tarde',
  unable: 'No puedo',
};
