-- ─── Helper: get current user's role ─────────────────────────────────────────
-- security definer so it always queries profiles with elevated privileges
-- stable so Postgres can cache it per-query
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- ─── Enable RLS on all tables ─────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.musicians     enable row level security;
alter table public.hotels        enable row level security;
alter table public.events        enable row level security;
alter table public.notifications enable row level security;

-- ─── profiles ─────────────────────────────────────────────────────────────────
create policy "profiles: user can view own, manager can view all"
  on public.profiles for select
  using (user_id = auth.uid() or public.get_my_role() = 'manager');

create policy "profiles: user can update own"
  on public.profiles for update
  using (user_id = auth.uid());

create policy "profiles: manager can update any"
  on public.profiles for update
  using (public.get_my_role() = 'manager');

create policy "profiles: insert own on signup"
  on public.profiles for insert
  with check (user_id = auth.uid());

-- ─── musicians ────────────────────────────────────────────────────────────────
create policy "musicians: manager can view all"
  on public.musicians for select
  using (public.get_my_role() = 'manager');

-- A musician sees their own row matched by email
create policy "musicians: musician sees own row"
  on public.musicians for select
  using (
    public.get_my_role() = 'musician'
    and email = (select email from auth.users where id = auth.uid())
  );

create policy "musicians: manager can insert"
  on public.musicians for insert
  with check (public.get_my_role() = 'manager');

create policy "musicians: manager can update"
  on public.musicians for update
  using (public.get_my_role() = 'manager');

create policy "musicians: manager can delete"
  on public.musicians for delete
  using (public.get_my_role() = 'manager');

-- ─── hotels ───────────────────────────────────────────────────────────────────
create policy "hotels: manager can view all"
  on public.hotels for select
  using (public.get_my_role() = 'manager');

-- A hotel user sees the hotel linked in their profile
create policy "hotels: hotel user sees own record"
  on public.hotels for select
  using (
    public.get_my_role() = 'hotel'
    and id = (select hotel_id from public.profiles where user_id = auth.uid())
  );

create policy "hotels: manager can insert"
  on public.hotels for insert
  with check (public.get_my_role() = 'manager');

create policy "hotels: manager can update"
  on public.hotels for update
  using (public.get_my_role() = 'manager');

create policy "hotels: manager can delete"
  on public.hotels for delete
  using (public.get_my_role() = 'manager');

-- ─── events ───────────────────────────────────────────────────────────────────
-- Manager sees all
create policy "events: manager sees all"
  on public.events for select
  using (public.get_my_role() = 'manager');

-- Musician sees only events where musician_id matches their musicians row
create policy "events: musician sees own events"
  on public.events for select
  using (
    public.get_my_role() = 'musician'
    and musician_id = (
      select id from public.musicians
      where email = (select email from auth.users where id = auth.uid())
    )
  );

-- Hotel user sees events at their hotel
create policy "events: hotel user sees own hotel events"
  on public.events for select
  using (
    public.get_my_role() = 'hotel'
    and hotel_id = (select hotel_id from public.profiles where user_id = auth.uid())
  );

-- Only managers create / delete events
create policy "events: manager can insert"
  on public.events for insert
  with check (public.get_my_role() = 'manager');

create policy "events: manager can delete"
  on public.events for delete
  using (public.get_my_role() = 'manager');

-- Managers can update any event field
create policy "events: manager can update"
  on public.events for update
  using (public.get_my_role() = 'manager');

-- Musicians can update check-in fields on their own events
create policy "events: musician can submit check-in on own event"
  on public.events for update
  using (
    public.get_my_role() = 'musician'
    and musician_id = (
      select id from public.musicians
      where email = (select email from auth.users where id = auth.uid())
    )
  );

-- ─── notifications ────────────────────────────────────────────────────────────
create policy "notifications: user sees own"
  on public.notifications for select
  using (user_id = auth.uid());

-- Insert allowed for authenticated users (service role bypasses RLS for system inserts)
create policy "notifications: authenticated can insert"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

create policy "notifications: user can mark own as read"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "notifications: user can delete own"
  on public.notifications for delete
  using (user_id = auth.uid());
