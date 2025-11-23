-- ============================================
-- MSM Munich Scholar Mentors - Supabase Setup
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query

-- ============================================
-- 1. TUTORS TABLE
-- ============================================
create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  subjects text[], -- z.B. ['Mathematik', 'Physik', 'Chemie']
  bio text,
  image_url text,
  rating numeric(3,2), -- z.B. 4.95
  olympiad_wins integer default 0,
  university text,
  calcom_username text, -- Cal.com username für API Integration (z.B. 'alexander-schmidt')
  availability_text text, -- Text-basierte Verfügbarkeit (z.B. 'Mo-Fr nachmittags')
  available_slots jsonb, -- Strukturierte Zeitfenster: [{"day": "monday", "times": ["14:00", "15:00"]}]
  hourly_rate integer, -- Stundensatz in Euro
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================
-- 2. BOOKINGS TABLE
-- ============================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  calcom_booking_id text unique not null, -- ID from Cal.com
  user_id uuid references auth.users(id) on delete cascade not null,
  tutor_id uuid references public.tutors(id) on delete set null,
  subject text not null,
  package text, -- z.B. 'Einzelstunde', 'Paket 5', 'Paket 10'
  date date not null,
  time text not null, -- z.B. '14:00:00'
  location text not null, -- 'online' oder 'in-person'
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  message text,
  status text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================
-- 3. MESSAGES TABLE (für Sendbird Sync)
-- ============================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tutor_id uuid references public.tutors(id) on delete set null,
  sendbird_channel_url text,
  last_message text,
  unread_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================
alter table public.tutors enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;

-- ============================================
-- 5. POLICIES FOR TUTORS
-- ============================================
-- Everyone can view tutors (public)
create policy "Tutors are viewable by everyone"
on public.tutors
for select
using (true);

-- Only admins can insert/update/delete tutors
-- (You can add admin role logic here later)

-- ============================================
-- 6. POLICIES FOR BOOKINGS
-- ============================================
-- Users can view their own bookings
create policy "Users can view own bookings"
on public.bookings
for select
using (auth.uid() = user_id);

-- Users can insert their own bookings
create policy "Users can insert own bookings"
on public.bookings
for insert
with check (auth.uid() = user_id);

-- Users can update their own bookings
create policy "Users can update own bookings"
on public.bookings
for update
using (auth.uid() = user_id);

-- Users can delete their own bookings
create policy "Users can delete own bookings"
on public.bookings
for delete
using (auth.uid() = user_id);

-- ============================================
-- 7. POLICIES FOR MESSAGES
-- ============================================
-- Users can view their own messages
create policy "Users can view own messages"
on public.messages
for select
using (auth.uid() = user_id);

-- Users can insert their own messages
create policy "Users can insert own messages"
on public.messages
for insert
with check (auth.uid() = user_id);

-- Users can update their own messages
create policy "Users can update own messages"
on public.messages
for update
using (auth.uid() = user_id);

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================
create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_tutor_id_idx on public.bookings(tutor_id);
create index if not exists bookings_date_idx on public.bookings(date);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_calcom_id_idx on public.bookings(calcom_booking_id);
create index if not exists messages_user_id_idx on public.messages(user_id);

-- ============================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger tutors_updated_at
  before update on public.tutors
  for each row
  execute function public.handle_updated_at();

create trigger bookings_updated_at
  before update on public.bookings
  for each row
  execute function public.handle_updated_at();

create trigger messages_updated_at
  before update on public.messages
  for each row
  execute function public.handle_updated_at();

-- ============================================
-- 10. INSERT SAMPLE TUTORS (Optional)
-- ============================================
insert into public.tutors (name, email, subjects, bio, rating, olympiad_wins, university, hourly_rate, availability_text, available_slots, calcom_username) values
  (
    'Alexander Schmidt', 
    'alexander@msm-munich.de', 
    ARRAY['Mathematik', 'Physik'], 
    'Bundessieger Mathematik-Olympiade 2023, Gold-Medaille Internationale Physik-Olympiade', 
    4.95, 
    3, 
    'TU München',
    65,
    'Mo-Fr nachmittags',
    '[
      {"day": "monday", "times": ["14:00", "15:00", "16:00", "17:00"]},
      {"day": "tuesday", "times": ["14:00", "15:00", "16:00", "17:00"]},
      {"day": "wednesday", "times": ["14:00", "15:00", "16:00", "17:00"]},
      {"day": "thursday", "times": ["14:00", "15:00", "16:00", "17:00"]},
      {"day": "friday", "times": ["14:00", "15:00", "16:00", "17:00"]}
    ]'::jsonb,
    'alexander-schmidt'
  ),
  (
    'Sophie Weber', 
    'sophie@msm-munich.de', 
    ARRAY['Chemie', 'Biologie'], 
    '1. Platz Jugend forscht (Chemie), Stipendiatin Studienstiftung', 
    4.90, 
    2, 
    'LMU München',
    60,
    'Mo, Mi, Fr',
    '[
      {"day": "monday", "times": ["10:00", "11:00", "12:00", "15:00", "16:00"]},
      {"day": "wednesday", "times": ["10:00", "11:00", "12:00", "15:00", "16:00"]},
      {"day": "friday", "times": ["10:00", "11:00", "12:00", "15:00", "16:00"]}
    ]'::jsonb,
    'sophie-weber'
  ),
  (
    'Maximilian Hoffmann', 
    'max@msm-munich.de', 
    ARRAY['Informatik', 'Mathematik'], 
    'Bundeswettbewerb Informatik Sieger, First Robotics Competition Team Lead', 
    4.88, 
    1, 
    'ETH Zürich',
    70,
    'Di-Do abends',
    '[
      {"day": "tuesday", "times": ["17:00", "18:00", "19:00", "20:00"]},
      {"day": "wednesday", "times": ["17:00", "18:00", "19:00", "20:00"]},
      {"day": "thursday", "times": ["17:00", "18:00", "19:00", "20:00"]}
    ]'::jsonb,
    'maximilian-hoffmann'
  ),
  (
    'Laura Zimmermann', 
    'laura@msm-munich.de', 
    ARRAY['Englisch', 'Spanisch'], 
    'Cambridge Proficiency Grade A, DELE C2 (Spanisch)', 
    4.85, 
    0, 
    'Dolmetschen München',
    55,
    'Flexibel',
    '[
      {"day": "monday", "times": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]},
      {"day": "tuesday", "times": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]},
      {"day": "wednesday", "times": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]},
      {"day": "thursday", "times": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]},
      {"day": "friday", "times": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]},
      {"day": "saturday", "times": ["10:00", "11:00", "12:00", "13:00"]}
    ]'::jsonb,
    'laura-zimmermann'
  ),
  (
    'David Chen', 
    'david@msm-munich.de', 
    ARRAY['Mathematik', 'Informatik', 'Physik'], 
    'Internationale Mathematik-Olympiade Medaille, Google Science Fair Finalist', 
    4.92, 
    2, 
    'MIT',
    70,
    'Online flexibel',
    '[
      {"day": "monday", "times": ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]},
      {"day": "tuesday", "times": ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]},
      {"day": "wednesday", "times": ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]},
      {"day": "thursday", "times": ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]},
      {"day": "friday", "times": ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]},
      {"day": "saturday", "times": ["11:00", "13:00", "15:00"]},
      {"day": "sunday", "times": ["11:00", "13:00", "15:00"]}
    ]'::jsonb,
    'david-chen'
  ),
  (
    'Emma Müller', 
    'emma@msm-munich.de', 
    ARRAY['Latein', 'Geschichte', 'Deutsch'], 
    'Bundeswettbewerb Fremdsprachen 1. Platz, Certamen Ciceronianum Gold', 
    4.87, 
    1, 
    'Altphilologie Heidelberg',
    50,
    'Wochenende',
    '[
      {"day": "saturday", "times": ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]},
      {"day": "sunday", "times": ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]}
    ]'::jsonb,
    'emma-mueller'
  )
on conflict (email) do nothing;

-- ============================================
-- DONE! Your Supabase database is ready.
-- ============================================
-- Next steps:
-- 1. Configure Supabase Auth redirect URLs in Dashboard
-- 2. Add environment variables to Vercel
-- 3. Test booking flow
