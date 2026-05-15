-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Links auth.users to app roles. role = null means "pending assignment".
create table public.profiles (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null unique references auth.users(id) on delete cascade,
  role       text        check (role in ('musician', 'manager', 'hotel')),
  is_active  boolean     not null default true,
  hotel_id   uuid,                            -- set when role = 'hotel'
  created_at timestamptz not null default now()
);

-- ─── musicians ────────────────────────────────────────────────────────────────
create table public.musicians (
  id           uuid        primary key default uuid_generate_v4(),
  name         text        not null,
  email        text        not null unique,
  phone        text        not null,
  shows        text[]      not null default '{}',
  hourly_rate  numeric     not null,
  is_active    boolean     not null default true,
  avatar       text,
  created_at   timestamptz not null default now()
);

-- ─── hotels ───────────────────────────────────────────────────────────────────
create table public.hotels (
  id             uuid        primary key default uuid_generate_v4(),
  name           text        not null,
  email          text        not null unique,
  phone          text        not null,
  location       text        not null,
  contact_person text        not null,
  is_active      boolean     not null default true,
  avatar         text,
  created_at     timestamptz not null default now()
);

-- Add FK from profiles → hotels now that hotels table exists
alter table public.profiles
  add constraint profiles_hotel_id_fkey
  foreign key (hotel_id) references public.hotels(id) on delete set null;

-- ─── events ───────────────────────────────────────────────────────────────────
create table public.events (
  id                uuid        primary key default uuid_generate_v4(),
  title             text        not null,
  description       text,
  date              date        not null,
  time              time        not null,
  duration_minutes  integer     not null check (duration_minutes > 0 and duration_minutes <= 720),
  hotel             text        not null,          -- denormalized display name
  hotel_id          uuid        references public.hotels(id) on delete set null,
  musician          text,                           -- denormalized display name
  musician_id       uuid        references public.musicians(id) on delete set null,
  status            text        not null default 'scheduled'
                                check (status in ('scheduled', 'in-progress', 'completed', 'cancelled')),
  checked_in        boolean     not null default false,
  check_in_time     timestamptz,
  check_in_photo    text,
  check_in_location jsonb,                          -- { "lat": float, "lng": float }
  check_in_comments text,
  created_at        timestamptz not null default now()
);

create index events_date_idx        on public.events (date);
create index events_musician_id_idx on public.events (musician_id);
create index events_hotel_id_idx    on public.events (hotel_id);
create index events_status_idx      on public.events (status);

-- ─── notifications ────────────────────────────────────────────────────────────
create table public.notifications (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  message     text        not null,
  type        text        not null check (type in ('info', 'warning', 'success', 'error')),
  read        boolean     not null default false,
  timestamp   timestamptz not null default now(),
  action_url  text,
  action_text text,
  event_id    uuid        references public.events(id) on delete set null
);

create index notifications_user_id_idx  on public.notifications (user_id);
create index notifications_timestamp_idx on public.notifications (timestamp desc);
