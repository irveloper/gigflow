-- ─── checkin-photos bucket ────────────────────────────────────────────────────
-- Private bucket — all access requires signed URLs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkin-photos',
  'checkin-photos',
  false,
  10485760,         -- 10 MB per photo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Authenticated users can upload to their own folder: {userId}/{eventId}/filename
create policy "storage: users can upload own check-in photos"
  on storage.objects for insert
  with check (
    bucket_id = 'checkin-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own photos; managers can read all
create policy "storage: users can read own photos, managers read all"
  on storage.objects for select
  using (
    bucket_id = 'checkin-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.get_my_role() = 'manager'
    )
  );

-- Users can delete their own photos; managers can delete any
create policy "storage: users can delete own photos, managers delete all"
  on storage.objects for delete
  using (
    bucket_id = 'checkin-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.get_my_role() = 'manager'
    )
  );
