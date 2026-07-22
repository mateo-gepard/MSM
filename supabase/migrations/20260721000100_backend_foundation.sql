begin;

create extension if not exists pgcrypto;

-- Preserve incompatible hand-created tables for a deliberate, audited import.
do $$
begin
  if to_regclass('public.tutors') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'tutors' and column_name = 'slug'
     )
     and to_regclass('public.tutors_legacy_20260721') is null then
    alter table public.tutors rename to tutors_legacy_20260721;
  end if;

  if to_regclass('public.bookings') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'bookings' and column_name = 'starts_at'
     )
     and to_regclass('public.bookings_legacy_20260721') is null then
    alter table public.bookings rename to bookings_legacy_20260721;
  end if;

  if to_regclass('public.packages_purchased') is not null
     and to_regclass('public.package_purchases_legacy_20260721') is null then
    alter table public.packages_purchased rename to package_purchases_legacy_20260721;
  end if;

  if to_regclass('public.tutors_legacy_20260721') is not null then
    execute 'revoke all on public.tutors_legacy_20260721 from anon, authenticated';
  end if;
  if to_regclass('public.bookings_legacy_20260721') is not null then
    execute 'revoke all on public.bookings_legacy_20260721 from anon, authenticated';
  end if;
  if to_regclass('public.package_purchases_legacy_20260721') is not null then
    execute 'revoke all on public.package_purchases_legacy_20260721 from anon, authenticated';
  end if;
  if to_regclass('public.messages') is not null then
    execute 'revoke insert, update, delete on public.messages from anon, authenticated';
  end if;
end
$$;

do $$ begin
  create type public.user_role as enum ('parent', 'tutor', 'admin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_status as enum ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.purchase_status as enum ('active', 'completed', 'expired', 'cancelled');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_status as enum ('unverified', 'verified', 'refunded');
exception when duplicate_object then null;
end $$;

create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  subject_ids text[] not null default '{}',
  achievements text[] not null default '{}',
  image_path text not null,
  bio text not null,
  languages text[] not null default '{}',
  availability_text text not null,
  available_slots jsonb not null default '[]'::jsonb,
  grade text not null,
  online_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'parent',
  tutor_id uuid references public.tutors(id) on delete restrict,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_tutor_role check (
    (role = 'tutor' and tutor_id is not null) or
    (role <> 'tutor' and tutor_id is null)
  )
);
create unique index if not exists profiles_one_account_per_tutor
  on public.profiles(tutor_id) where tutor_id is not null;

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sessions integer not null check (sessions > 0),
  price_cents integer not null check (price_cents >= 0),
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  savings_cents integer check (savings_cents is null or savings_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.package_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  status public.purchase_status not null default 'active',
  payment_status public.payment_status not null default 'unverified',
  payment_reference text,
  price_paid_cents integer not null check (price_paid_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint package_credit_balance check (used_sessions + remaining_sessions = total_sessions),
  constraint verified_payment_reference check (
    payment_status <> 'verified' or payment_reference is not null
  )
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  tutor_id uuid not null references public.tutors(id) on delete restrict,
  package_id uuid not null references public.packages(id) on delete restrict,
  package_purchase_id uuid references public.package_purchases(id) on delete restrict,
  subject_id text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
  time_zone text not null,
  location text not null check (location in ('online', 'in-person')),
  location_venue text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  message text,
  status public.booking_status not null default 'scheduled',
  calcom_booking_uid text not null unique,
  calcom_event_type_id integer not null check (calcom_event_type_id > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint in_person_has_venue check (location <> 'in-person' or nullif(trim(location_venue), '') is not null)
);

create index if not exists bookings_user_starts_idx on public.bookings(user_id, starts_at);
create index if not exists bookings_tutor_starts_idx on public.bookings(tutor_id, starts_at);
create index if not exists bookings_status_idx on public.bookings(status);
create unique index if not exists bookings_one_scheduled_tutor_slot
  on public.bookings(tutor_id, starts_at) where status = 'scheduled';
create unique index if not exists bookings_one_trial_per_user
  on public.bookings(user_id)
  where package_id = 'a497cc91-10a1-5ac1-9000-000000000001'::uuid;
create index if not exists package_purchases_user_status_idx
  on public.package_purchases(user_id, payment_status, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists tutors_set_updated_at on public.tutors;
create trigger tutors_set_updated_at before update on public.tutors
for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at before update on public.packages
for each row execute function public.set_updated_at();
drop trigger if exists package_purchases_set_updated_at on public.package_purchases;
create trigger package_purchases_set_updated_at before update on public.package_purchases
for each row execute function public.set_updated_at();
drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select id, nullif(trim(coalesce(raw_user_meta_data ->> 'name', '')), '')
from auth.users
on conflict (id) do nothing;

insert into public.tutors (
  id, slug, name, subject_ids, achievements, image_path, bio, languages,
  availability_text, available_slots, grade, online_only
) values
(
  '65af49a0-33dc-5a71-9000-000000000001', 'juan-rivera-chopinaud', 'Juan Rivera Chopinaud',
  array['math','physics','spanish'],
  array['1. Preis bei der Mathematikolympiade','Schüler an einer englischen Schule mit International Baccalaureate','Mehrsprachig und international erfahren'],
  '/tutors/juan.jpg', 'Erfolgreich in Mathe und Physik, quadrilingual',
  array['Deutsch','Englisch','Spanisch','Französisch'], 'Di, Mi, Sa 17:30-19:00',
  '[{"day":"tuesday","times":["17:30","18:00","18:30"]},{"day":"wednesday","times":["17:30","18:00","18:30"]},{"day":"saturday","times":["17:30","18:00","18:30"]}]',
  'Klasse 12 (L6)', true
),
(
  '65af49a0-33dc-5a71-9000-000000000002', 'mateo-mamaladze', 'Mateo Mamaladze',
  array['physics','cs','math','biology'],
  array['Erfolgreiche Teilnahme an einer internationalen Physikolympiade','Leitet einen Robotikkurs an seiner Schule','Langjährige Erfahrung mit CAD, 3D Druck und Programmieren'],
  '/tutors/Mateo.JPG', 'Hobbyingenieur mit Begeisterung für Physik', array['Deutsch','Englisch','Georgisch'],
  'Mo-Fr ab 14 Uhr',
  '[{"day":"monday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"tuesday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"wednesday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"thursday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"friday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]}]',
  'Klassenstufe 12', false
),
(
  '65af49a0-33dc-5a71-9000-000000000003', 'roman-daugavet', 'Roman Daugavet',
  array['math','physics'],
  array['1. Preis Bundeswettbewerb Mathematik','Frühstudium in Mathematik','Frühstudium in Luftfahrt und Raumfahrttechnik'],
  '/tutors/Roman.png', 'Leidenschaftlicher Mathematiker und Physiker', array['Deutsch','Russisch'],
  'Mo, Mi, Fr 15-17 Uhr',
  '[{"day":"monday","times":["15:00","15:30","16:00","16:30"]},{"day":"wednesday","times":["15:00","15:30","16:00","16:30"]},{"day":"friday","times":["15:00","15:30","16:00","16:30"]}]',
  'Klassenstufe 11', false
),
(
  '65af49a0-33dc-5a71-9000-000000000004', 'len-sobol', 'Len Sobol',
  array['physics','cs','math'],
  array['Arbeitet seit 3 Jahren als Software Developer','Frühstudium in Luftfahrt und Raumfahrttechnik','Frühstudium in Physik'],
  '/tutors/Len.JPG', 'Physiker, talentierter Programmierer und Robotikexperte', array['Deutsch','Englisch'],
  'Mo-Fr ab 14 Uhr',
  '[{"day":"monday","times":["16:30","17:00","17:30","18:00"]},{"day":"wednesday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"thursday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"friday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]}]',
  'Klassenstufe 13', false
),
(
  '65af49a0-33dc-5a71-9000-000000000005', 'johannes-jacob', 'Johannes Jacob',
  array['math','physics'],
  array['Bester Mathematiker unter allen Schülern in Deutschland','Frühstudent in Analysis und Technischer Mechanik','Sehr erfahren in Wettbewerbsvorbereitung von jungen Talenten'],
  '/tutors/Johannes.jpg', 'Äußerst erfolgreicher Mathematiker', array['Deutsch'],
  'Mo-Fr ab 14 Uhr',
  '[{"day":"monday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"tuesday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"wednesday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"thursday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]},{"day":"friday","times":["14:00","14:30","15:00","15:30","16:00","16:30","17:00"]}]',
  'Klassenstufe 11', false
)
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, subject_ids = excluded.subject_ids,
  achievements = excluded.achievements, image_path = excluded.image_path, bio = excluded.bio,
  languages = excluded.languages, availability_text = excluded.availability_text,
  available_slots = excluded.available_slots, grade = excluded.grade,
  online_only = excluded.online_only, active = true;

insert into public.packages (
  id, slug, name, sessions, price_cents, hourly_rate_cents, savings_cents
) values
  ('a497cc91-10a1-5ac1-9000-000000000001', 'trial', 'Probestunde', 1, 0, null, null),
  ('a497cc91-10a1-5ac1-9000-000000000002', 'medium', '10er Paket', 10, 29000, 2900, 10000),
  ('a497cc91-10a1-5ac1-9000-000000000003', 'small', '5er Paket', 5, 17500, 3500, 2000),
  ('a497cc91-10a1-5ac1-9000-000000000004', 'single', 'Einzelstunde', 1, 3900, null, null)
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, sessions = excluded.sessions,
  price_cents = excluded.price_cents, hourly_rate_cents = excluded.hourly_rate_cents,
  savings_cents = excluded.savings_cents, active = true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.tutors enable row level security;
alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.package_purchases enable row level security;
alter table public.bookings enable row level security;

drop policy if exists tutors_public_read on public.tutors;
create policy tutors_public_read on public.tutors for select using (active);
drop policy if exists tutors_assigned_update on public.tutors;
create policy tutors_assigned_update on public.tutors for update to authenticated
using (
  public.is_admin() or exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'tutor' and p.tutor_id = tutors.id
  )
)
with check (
  public.is_admin() or exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'tutor' and p.tutor_id = tutors.id
  )
);

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_own_display_name_update on public.profiles;
create policy profiles_own_display_name_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists packages_public_read on public.packages;
create policy packages_public_read on public.packages for select using (active);

drop policy if exists package_purchases_owner_read on public.package_purchases;
create policy package_purchases_owner_read on public.package_purchases for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists bookings_authorized_read on public.bookings;
create policy bookings_authorized_read on public.bookings for select to authenticated
using (
  user_id = auth.uid() or public.is_admin() or exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'tutor' and p.tutor_id = bookings.tutor_id
  )
);

revoke all on public.tutors, public.profiles, public.packages, public.package_purchases, public.bookings
from anon, authenticated;
grant select on public.tutors, public.packages to anon, authenticated;
grant select on public.profiles, public.package_purchases, public.bookings to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (available_slots, availability_text) on public.tutors to authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.finalize_booking_with_credit(
  p_user_id uuid,
  p_tutor_id uuid,
  p_package_id uuid,
  p_package_purchase_id uuid,
  p_subject_id text,
  p_starts_at timestamptz,
  p_time_zone text,
  p_location text,
  p_location_venue text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_message text,
  p_calcom_booking_uid text,
  p_calcom_event_type_id integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_package_slug text;
  v_purchase public.package_purchases%rowtype;
begin
  if p_starts_at <= now() then raise exception 'INVALID_START_TIME'; end if;
  if p_location not in ('online', 'in-person') then raise exception 'INVALID_LOCATION'; end if;
  if p_location = 'in-person' and nullif(trim(p_location_venue), '') is null then
    raise exception 'VENUE_REQUIRED';
  end if;

  if not exists(
    select 1 from public.tutors
    where id = p_tutor_id and active and p_subject_id = any(subject_ids)
  ) then raise exception 'INVALID_TUTOR_SUBJECT'; end if;

  select slug into v_package_slug from public.packages
  where id = p_package_id and active;
  if v_package_slug is null then raise exception 'INVALID_PACKAGE'; end if;

  if v_package_slug = 'trial' then
    if p_package_purchase_id is not null then raise exception 'INVALID_TRIAL_ENTITLEMENT'; end if;
    if exists(select 1 from public.bookings where user_id = p_user_id) then
      raise exception 'TRIAL_NOT_ALLOWED';
    end if;
  else
    if p_package_purchase_id is null then raise exception 'PACKAGE_REQUIRED'; end if;
    select * into v_purchase from public.package_purchases
    where id = p_package_purchase_id and user_id = p_user_id and package_id = p_package_id
    for update;
    if not found then raise exception 'PACKAGE_REQUIRED'; end if;
    if v_purchase.payment_status <> 'verified' then raise exception 'PAYMENT_NOT_VERIFIED'; end if;
    if v_purchase.status <> 'active' or v_purchase.remaining_sessions <= 0 then
      raise exception 'NO_CREDITS';
    end if;

    update public.package_purchases
    set used_sessions = used_sessions + 1,
        remaining_sessions = remaining_sessions - 1,
        status = case when remaining_sessions = 1 then 'completed'::public.purchase_status else status end,
        completed_at = case when remaining_sessions = 1 then now() else completed_at end
    where id = v_purchase.id;
  end if;

  insert into public.bookings (
    user_id, tutor_id, package_id, package_purchase_id, subject_id, starts_at,
    time_zone, location, location_venue, contact_name, contact_email,
    contact_phone, message, calcom_booking_uid, calcom_event_type_id
  ) values (
    p_user_id, p_tutor_id, p_package_id, p_package_purchase_id, p_subject_id, p_starts_at,
    p_time_zone, p_location, nullif(trim(p_location_venue), ''), p_contact_name, p_contact_email,
    nullif(trim(p_contact_phone), ''), nullif(trim(p_message), ''),
    p_calcom_booking_uid, p_calcom_event_type_id
  ) returning id into v_booking_id;

  return v_booking_id;
end
$$;

revoke all on function public.finalize_booking_with_credit(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.finalize_booking_with_credit(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text, text, text, text, integer
) to service_role;

create or replace function public.cancel_booking_and_restore_credit(
  p_booking_id uuid,
  p_expected_calcom_uid text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_credit_restored boolean := false;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and calcom_booking_uid = p_expected_calcom_uid
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if v_booking.status = 'cancelled' then return false; end if;
  if v_booking.status <> 'scheduled' then
    raise exception 'BOOKING_NOT_CANCELLABLE';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now()
  where id = v_booking.id;

  if v_booking.package_purchase_id is not null then
    update public.package_purchases
    set used_sessions = used_sessions - 1,
        remaining_sessions = remaining_sessions + 1,
        status = 'active',
        completed_at = null
    where id = v_booking.package_purchase_id
      and user_id = v_booking.user_id
      and package_id = v_booking.package_id
      and used_sessions > 0;
    if not found then raise exception 'CREDIT_RESTORE_FAILED'; end if;
    v_credit_restored := true;
  end if;

  return v_credit_restored;
end
$$;

revoke all on function public.cancel_booking_and_restore_credit(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_booking_and_restore_credit(uuid, text)
to service_role;

commit;
