-- ============================================================================
--  MINISTERIO DE ALABANZA "NUESTRO HOGAR"
--  01 · schema.sql — extensiones, enums, tablas, constraints e índices
--  Ejecutar PRIMERO.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
do $$ begin
  create type public.app_role as enum ('admin', 'musician');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_type as enum ('rehearsal', 'service', 'special');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('attending', 'not_attending', 'late', 'unable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.file_category as enum ('pdf', 'word', 'image', 'audio', 'score', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('push', 'email', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('pending', 'sent', 'failed');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------- instruments ----
create table if not exists public.instruments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint instruments_name_unique unique (name),
  constraint instruments_name_not_blank check (length(btrim(name)) > 0)
);

-- ------------------------------------------------------------ profiles ----
-- 1:1 con auth.users. Se crea automáticamente vía trigger (functions.sql).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  first_name    text not null default '',
  last_name     text not null default '',
  email         text not null,
  phone         text,
  instrument_id uuid references public.instruments(id) on delete set null,
  role          public.app_role not null default 'musician',
  active        boolean not null default true,
  joined_at     date default current_date,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_email_unique unique (email)
);

-- --------------------------------------------------------------- songs ----
create table if not exists public.songs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  author           text,
  song_key         text,
  bpm              integer,
  duration_seconds integer,
  capo             text,
  version          text,
  notes            text,
  lyrics           text,
  spotify_url      text,
  youtube_url      text,
  pdf_path         text,
  score_path       text,
  audio_path       text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint songs_title_not_blank check (length(btrim(title)) > 0),
  constraint songs_bpm_range       check (bpm is null or bpm between 1 and 400),
  constraint songs_duration_range  check (duration_seconds is null or duration_seconds between 1 and 7200),
  constraint songs_spotify_url_fmt check (spotify_url is null or spotify_url ~* '^https?://'),
  constraint songs_youtube_url_fmt check (youtube_url  is null or youtube_url  ~* '^https?://')
);

-- -------------------------------------------------------------- events ----
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  event_type       public.event_type not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  location         text,
  description      text,
  responsible_id   uuid references public.profiles(id) on delete set null,
  service_type     text,
  preacher         text,
  observations     text,
  special_category text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint events_title_not_blank check (length(btrim(title)) > 0),
  constraint events_end_after_start check (ends_at is null or ends_at > starts_at)
);

-- --------------------------------------------------------- event_songs ----
create table if not exists public.event_songs (
  event_id uuid not null references public.events(id) on delete cascade,
  song_id  uuid not null references public.songs(id)  on delete cascade,
  position integer not null default 0,
  notes    text,
  primary key (event_id, song_id),
  constraint event_songs_position_positive check (position >= 0)
);

-- ---------------------------------------------------------- attendance ----
create table if not exists public.attendance (
  event_id     uuid not null references public.events(id)   on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  status       public.attendance_status not null,
  notes        text,
  responded_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- --------------------------------------------------------------- files ----
create table if not exists public.files (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references public.profiles(id) on delete set null,
  name       text not null,
  path       text not null,
  mime_type  text,
  size_bytes bigint,
  category   public.file_category not null default 'other',
  created_at timestamptz not null default now(),
  constraint files_path_unique unique (path),
  constraint files_size_positive check (size_bytes is null or size_bytes >= 0)
);

-- ------------------------------------------------------- announcements ----
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  published  boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint announcements_title_not_blank check (length(btrim(title)) > 0)
);

-- --------------------------------------------------- notification_logs ----
-- Toda notificación (push / correo / whatsapp) queda registrada aquí,
-- incluidos los fallos, con su motivo.
create table if not exists public.notification_logs (
  id              uuid primary key default gen_random_uuid(),
  channel         public.notification_channel not null,
  recipient       text,
  subject         text,
  body            text not null,
  status          public.notification_status not null default 'pending',
  error           text,
  announcement_id uuid references public.announcements(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

-- ---------------------------------------------------- ministry_settings ---
-- Fila única (id = true) con la configuración global del ministerio.
create table if not exists public.ministry_settings (
  id                     boolean primary key default true,
  name                   text not null default 'Ministerio de Alabanza Nuestro Hogar',
  logo_url               text,
  primary_color          text not null default '#590776',
  address                text,
  phones                 text[] default '{}',
  schedule               text,
  socials                jsonb not null default '{}'::jsonb,
  notifications_enabled  jsonb not null default '{"push":false,"email":false,"whatsapp":false}'::jsonb,
  updated_at             timestamptz not null default now(),
  constraint ministry_settings_single_row check (id),
  constraint ministry_settings_color_fmt  check (primary_color ~* '^#[0-9a-f]{6}$')
);

-- ------------------------------------------------------------- índices ----
create index if not exists events_starts_at_idx     on public.events (starts_at desc);
create index if not exists events_type_idx           on public.events (event_type);
create index if not exists events_responsible_idx    on public.events (responsible_id);
create index if not exists songs_title_trgm_idx      on public.songs using gin (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(author, '')));
create index if not exists songs_title_idx           on public.songs (title);
create index if not exists profiles_email_idx        on public.profiles (lower(email));
create index if not exists profiles_role_active_idx  on public.profiles (role, active);
create index if not exists profiles_instrument_idx   on public.profiles (instrument_id);
create index if not exists attendance_profile_idx    on public.attendance (profile_id);
create index if not exists attendance_event_idx      on public.attendance (event_id);
create index if not exists files_owner_idx           on public.files (owner_id);
create index if not exists files_category_idx        on public.files (category);
create index if not exists event_songs_song_idx      on public.event_songs (song_id);
create index if not exists announcements_pub_idx     on public.announcements (published, created_at desc);
create index if not exists notif_logs_created_idx    on public.notification_logs (created_at desc);
