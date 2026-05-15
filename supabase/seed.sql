-- Seed data for local development
-- Run via: supabase db reset (applies migrations then this seed)
--
-- Demo password for all users: 123456
-- Deterministic UUIDs: auth users use 0000-0000-0000-0000-00000000000N format
--                      musicians use   0000-0000-0001-0000-00000000000N format
--                      hotels use      0000-0000-0002-0000-00000000000N format
--                      events use      0000-0000-0003-0000-00000000000N format
--                      notifications   0000-0000-0004-0000-00000000000N format

-- ─── Auth users ───────────────────────────────────────────────────────────────
-- password = crypt('123456', gen_salt('bf'))
-- email_confirmed_at set to now() so users can log in immediately

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, role, aud
) values
  -- musician: Carlos Mendoza
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'musico@test.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Carlos Mendoza"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  -- manager: Ana Garcia
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'gerente@test.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Ana Garcia"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  -- hotel: Hotel Paradisus
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'hotel@test.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Hotel Paradisus"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  -- musician: Ana Rodriguez
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'ana@test.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Ana Rodríguez"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  -- musician: Miguel Santos
  (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'miguel@test.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Miguel Santos"}',
    now(), now(), 'authenticated', 'authenticated'
  )
on conflict (id) do nothing;

-- ─── Hotels ───────────────────────────────────────────────────────────────────
insert into public.hotels (id, name, email, phone, location, contact_person, is_active, avatar, created_at) values
  (
    '00000000-0000-0002-0000-000000000001',
    'Hotel Paradisus Cancún',
    'eventos@paradisus.mx',
    '+52 998 888 0000',
    'Blvd. Kukulcan Km 16.5, Zona Hotelera, Cancún',
    'Roberto Martinez',
    true,
    '/placeholder-logo.png',
    '2026-04-21T00:00:00Z'
  ),
  (
    '00000000-0000-0002-0000-000000000002',
    'Hotel Moon Palace',
    'eventos@moonpalace.mx',
    '+52 998 777 1111',
    'Carretera Cancún-Chetumal Km 340, Cancún',
    'Laura Hernández',
    true,
    null,
    '2026-04-21T00:00:00Z'
  ),
  (
    '00000000-0000-0002-0000-000000000003',
    'Hotel Xcaret',
    'eventos@xcaret.mx',
    '+52 998 777 2222',
    'Carretera Federal 307 Km 282, Playa del Carmen',
    'Diego Ruiz',
    true,
    null,
    '2026-04-21T00:00:00Z'
  ),
  (
    '00000000-0000-0002-0000-000000000004',
    'Hotel Iberostar',
    'eventos@iberostar.mx',
    '+52 998 777 3333',
    'Blvd. Kukulcan Km 17, Zona Hotelera, Cancún',
    'Sofia Morales',
    true,
    null,
    '2026-04-21T00:00:00Z'
  )
on conflict (id) do nothing;

-- ─── Profiles ─────────────────────────────────────────────────────────────────
insert into public.profiles (user_id, role, is_active, hotel_id) values
  ('00000000-0000-0000-0000-000000000001', 'musician', true,  null),
  ('00000000-0000-0000-0000-000000000002', 'manager',  true,  null),
  ('00000000-0000-0000-0000-000000000003', 'hotel',    true,  '00000000-0000-0002-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'musician', true,  null),
  ('00000000-0000-0000-0000-000000000005', 'musician', true,  null)
on conflict (user_id) do nothing;

-- ─── Musicians ────────────────────────────────────────────────────────────────
insert into public.musicians (id, name, email, phone, shows, hourly_rate, is_active, avatar, created_at) values
  (
    '00000000-0000-0001-0000-000000000001',
    'Carlos Mendoza',
    'musico@test.com',
    '+52 998 123 4567',
    array['Acoustic Set', 'Jazz Trio', 'Solo Piano'],
    800,
    true,
    '/placeholder-user.jpg',
    '2026-04-21T00:00:00Z'
  ),
  (
    '00000000-0000-0001-0000-000000000002',
    'Ana Rodríguez',
    'ana@test.com',
    '+52 998 234 5678',
    array['Vocal Jazz', 'Bossa Nova', 'Boleros'],
    750,
    true,
    null,
    '2026-04-21T00:00:00Z'
  ),
  (
    '00000000-0000-0001-0000-000000000003',
    'Miguel Santos',
    'miguel@test.com',
    '+52 998 345 6789',
    array['Guitar Solo', 'Classical Guitar', 'Latin Jazz'],
    900,
    true,
    null,
    '2026-04-21T00:00:00Z'
  )
on conflict (id) do nothing;

-- ─── Events ───────────────────────────────────────────────────────────────────
-- Dates use CURRENT_DATE offsets so they stay current on every db reset
insert into public.events (
  id, title, description, date, time, duration_minutes,
  hotel, hotel_id, musician, musician_id,
  status, checked_in, check_in_time, created_at
) values
  -- event-1: today acoustic (Carlos, Paradisus)
  (
    '00000000-0000-0003-0000-000000000001',
    'Acoustic Set - Lobby',
    'Presentación acústica en el lobby principal',
    CURRENT_DATE, '19:00', 120,
    'Hotel Paradisus Cancún', '00000000-0000-0002-0000-000000000001',
    'Carlos Mendoza',          '00000000-0000-0001-0000-000000000001',
    'scheduled', false, null,
    '2026-04-21T00:00:00Z'
  ),
  -- event-2: today jazz (Carlos, Paradisus)
  (
    '00000000-0000-0003-0000-000000000002',
    'Jazz Trio - Restaurante',
    'Trio de jazz en el restaurante principal',
    CURRENT_DATE, '21:30', 90,
    'Hotel Paradisus Cancún', '00000000-0000-0002-0000-000000000001',
    'Carlos Mendoza',          '00000000-0000-0001-0000-000000000001',
    'scheduled', false, null,
    '2026-04-21T00:00:00Z'
  ),
  -- event-3: tomorrow piano (Carlos, Moon Palace)
  (
    '00000000-0000-0003-0000-000000000003',
    'Solo Piano - Bar',
    'Piano solo en el bar del hotel',
    CURRENT_DATE + 1, '20:00', 120,
    'Hotel Moon Palace', '00000000-0000-0002-0000-000000000002',
    'Carlos Mendoza',     '00000000-0000-0001-0000-000000000001',
    'scheduled', false, null,
    '2026-04-21T00:00:00Z'
  ),
  -- event-4: tomorrow vocal (Ana, Xcaret)
  (
    '00000000-0000-0003-0000-000000000004',
    'Vocal Jazz - Terraza',
    'Presentación vocal en la terraza',
    CURRENT_DATE + 1, '18:30', 90,
    'Hotel Xcaret', '00000000-0000-0002-0000-000000000003',
    'Ana Rodríguez', '00000000-0000-0001-0000-000000000002',
    'scheduled', false, null,
    '2026-04-21T00:00:00Z'
  ),
  -- event-5: next week guitar (Miguel, Iberostar)
  (
    '00000000-0000-0003-0000-000000000005',
    'Guitar Solo - Pool Bar',
    'Guitarra solista en el bar de la piscina',
    CURRENT_DATE + 7, '17:00', 120,
    'Hotel Iberostar', '00000000-0000-0002-0000-000000000004',
    'Miguel Santos',    '00000000-0000-0001-0000-000000000003',
    'scheduled', false, null,
    '2026-04-21T00:00:00Z'
  ),
  -- event-6: yesterday completed (Carlos, Moon Palace)
  (
    '00000000-0000-0003-0000-000000000006',
    'Latin Jazz - Terraza',
    'Sesión de latin jazz en la terraza del hotel',
    CURRENT_DATE - 1, '20:00', 90,
    'Hotel Moon Palace', '00000000-0000-0002-0000-000000000002',
    'Carlos Mendoza',     '00000000-0000-0001-0000-000000000001',
    'completed', true, (CURRENT_DATE - 1 + time '20:05:00')::timestamptz,
    '2026-04-21T00:00:00Z'
  ),
  -- event-7: 3 days ago completed (Ana, Xcaret)
  (
    '00000000-0000-0003-0000-000000000007',
    'Boleros Night - Lobby',
    'Noche de boleros en el lobby',
    CURRENT_DATE - 3, '21:00', 60,
    'Hotel Xcaret', '00000000-0000-0002-0000-000000000003',
    'Ana Rodríguez', '00000000-0000-0001-0000-000000000002',
    'completed', true, (CURRENT_DATE - 3 + time '21:03:00')::timestamptz,
    '2026-04-21T00:00:00Z'
  ),
  -- event-8: 3 days from now cancelled (Miguel, Iberostar)
  (
    '00000000-0000-0003-0000-000000000008',
    'Classical Night - Garden',
    'Noche clásica en el jardín',
    CURRENT_DATE + 3, '19:30', 90,
    'Hotel Iberostar', '00000000-0000-0002-0000-000000000004',
    'Miguel Santos',    '00000000-0000-0001-0000-000000000003',
    'cancelled', false, null,
    '2026-04-21T00:00:00Z'
  )
on conflict (id) do nothing;

-- ─── Notifications ────────────────────────────────────────────────────────────
-- Notifications belong to the musician user (user-1 = Carlos)
insert into public.notifications (id, user_id, title, message, type, read, timestamp, action_url, action_text, event_id) values
  (
    '00000000-0000-0004-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Nuevo evento asignado',
    'Se te ha asignado un nuevo evento: ''Acoustic Set - Lobby'' para hoy a las 19:00',
    'info', false, now(),
    '/check-in/00000000-0000-0003-0000-000000000001',
    'Ver evento',
    '00000000-0000-0003-0000-000000000001'
  ),
  (
    '00000000-0000-0004-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Recordatorio de check-in',
    'No olvides hacer check-in para tu presentación de hoy a las 21:30',
    'warning', false, now() - interval '2 hours',
    '/check-in/00000000-0000-0003-0000-000000000002',
    'Hacer check-in',
    '00000000-0000-0003-0000-000000000002'
  ),
  (
    '00000000-0000-0004-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Check-in confirmado',
    'Tu check-in para ''Jazz Trio - Restaurante'' ha sido registrado exitosamente',
    'success', true, now() - interval '1 day',
    null, null,
    '00000000-0000-0003-0000-000000000002'
  ),
  (
    '00000000-0000-0004-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Evento próximo',
    'Tienes una presentación mañana: ''Solo Piano - Bar'' a las 20:00',
    'info', false, now() - interval '1 day',
    '/calendar', 'Ver calendario',
    '00000000-0000-0003-0000-000000000003'
  ),
  (
    '00000000-0000-0004-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Pago procesado',
    'Se ha procesado el pago de $1,600 por tus presentaciones de la semana pasada',
    'success', true, now() - interval '2 days',
    null, null, null
  ),
  (
    '00000000-0000-0004-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Cambio de horario',
    'El evento ''Guitar Solo - Pool Bar'' ha sido reprogramado para las 17:30',
    'warning', false, now() - interval '2 days',
    '/calendar', 'Ver cambios',
    '00000000-0000-0003-0000-000000000005'
  )
on conflict (id) do nothing;
