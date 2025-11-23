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
insert into public.tutors (name, email, subjects, bio, rating, olympiad_wins, university) values
  ('Max Müller', 'max@msm-munich.de', ARRAY['Mathematik', 'Physik'], 'Internationale Mathe-Olympiade Goldmedaille', 4.95, 3, 'TU München'),
  ('Sophie Schmidt', 'sophie@msm-munich.de', ARRAY['Chemie', 'Biologie'], 'Chemie-Olympiade Siegerin', 4.90, 2, 'LMU München'),
  ('Leon Weber', 'leon@msm-munich.de', ARRAY['Informatik', 'Mathematik'], 'Informatik-Olympiade Finalist', 4.88, 1, 'TU München')
on conflict (email) do nothing;

-- ============================================
-- DONE! Your Supabase database is ready.
-- ============================================
-- Next steps:
-- 1. Configure Supabase Auth redirect URLs in Dashboard
-- 2. Add environment variables to Vercel
-- 3. Test booking flow
