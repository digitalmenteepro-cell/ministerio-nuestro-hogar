alter table public.events
  add column if not exists status text not null default 'active';

alter table public.events
  drop constraint if exists events_status_check;

alter table public.events
  add constraint events_status_check check (status in ('active', 'suspended'));
