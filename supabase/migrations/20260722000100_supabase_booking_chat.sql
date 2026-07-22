begin;

-- Chat history is owned by MSM instead of a second messaging provider. Writes
-- remain behind the Vercel API, while a private Supabase Realtime broadcast
-- delivers a minimized event to currently authorized booking participants.
create table public.booking_messages (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_context text not null check (sender_context in ('household', 'tutor')),
  client_message_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint booking_messages_sender_idempotency
    unique (sender_user_id, client_message_id)
);

create index booking_messages_booking_history_idx
  on public.booking_messages(booking_id, id desc);

create trigger booking_messages_append_only
before update or delete on public.booking_messages
for each row execute function public.reject_immutable_mutation();

alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from anon, authenticated;
grant select, insert on public.booking_messages to service_role;
grant usage, select on sequence public.booking_messages_id_seq to service_role;

-- The booking row lock makes message insertion and lifecycle transitions
-- serializable with respect to chat authorization. Provider callbacks cannot
-- make a booking terminal in the gap between the API check and this insert.
create or replace function public.validate_booking_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking
  from public.bookings
  where id = new.booking_id
  for share;

  if not found or v_booking.lifecycle_status not in (
    'provider_pending', 'pending_confirmation', 'scheduled',
    'cancellation_pending', 'reschedule_pending'
  ) then
    raise exception 'CHAT_NOT_ALLOWED' using errcode = '42501';
  end if;

  if new.sender_context = 'tutor' then
    if new.sender_user_id = v_booking.user_id
       or not public.has_active_account_role(
         new.sender_user_id, 'tutor', v_booking.tutor_id
       )
    then
      raise exception 'CHAT_NOT_ALLOWED' using errcode = '42501';
    end if;
  elsif new.sender_context = 'household' then
    if not public.has_active_account_role(new.sender_user_id, 'parent', null)
       or not exists (
         select 1
         from public.household_memberships hm
         join public.profiles p on p.id = hm.user_id
         where hm.user_id = new.sender_user_id
           and hm.household_id = v_booking.household_id
           and p.primary_household_id = v_booking.household_id
           and p.deactivated_at is null
           and hm.status = 'active'
           and hm.revoked_at is null
           and hm.active_from <= now()
           and (
             v_booking.user_id = new.sender_user_id
             or hm.can_view_all_bookings
           )
       )
       or not exists (
         select 1
         from public.account_roles tutor_role
         join public.profiles tutor_profile on tutor_profile.id = tutor_role.user_id
         where tutor_role.role = 'tutor'
           and tutor_role.tutor_id = v_booking.tutor_id
           and tutor_role.revoked_at is null
           and tutor_profile.deactivated_at is null
           and tutor_role.user_id <> new.sender_user_id
       )
    then
      raise exception 'CHAT_NOT_ALLOWED' using errcode = '42501';
    end if;
  else
    raise exception 'CHAT_NOT_ALLOWED' using errcode = '42501';
  end if;

  new.body := btrim(new.body);
  return new;
end
$$;

revoke all on function public.validate_booking_message_insert()
  from public, anon, authenticated;

create trigger booking_messages_validate_insert
before insert on public.booking_messages
for each row execute function public.validate_booking_message_insert();

-- Realtime evaluates this function only when an authenticated client joins a
-- private booking topic. It deliberately mirrors the Vercel route's live
-- booking, household, tutor, profile, role, and AAL2 checks.
create or replace function public.can_receive_booking_chat_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
begin
  if p_topic is null or p_topic !~
    '^booking:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then
    return false;
  end if;

  v_booking_id := substring(p_topic from 9)::uuid;

  return exists (
    select 1
    from public.bookings b
    where b.id = v_booking_id
      and b.lifecycle_status in (
        'provider_pending', 'pending_confirmation', 'scheduled',
        'cancellation_pending', 'reschedule_pending'
      )
      and (
        (
          b.user_id <> auth.uid()
          and public.is_assigned_tutor(b.tutor_id)
        )
        or
        (
          public.has_active_account_role(auth.uid(), 'parent', null)
          and exists (
            select 1
            from public.household_memberships hm
            join public.profiles p on p.id = hm.user_id
            where hm.user_id = auth.uid()
              and hm.household_id = b.household_id
              and p.primary_household_id = b.household_id
              and p.deactivated_at is null
              and hm.status = 'active'
              and hm.revoked_at is null
              and hm.active_from <= now()
              and (b.user_id = auth.uid() or hm.can_view_all_bookings)
          )
          and exists (
            select 1
            from public.account_roles tutor_role
            join public.profiles tutor_profile on tutor_profile.id = tutor_role.user_id
            where tutor_role.role = 'tutor'
              and tutor_role.tutor_id = b.tutor_id
              and tutor_role.revoked_at is null
              and tutor_profile.deactivated_at is null
              and tutor_role.user_id <> auth.uid()
          )
        )
      )
  );
end
$$;

revoke all on function public.can_receive_booking_chat_topic(text)
  from public, anon;
grant execute on function public.can_receive_booking_chat_topic(text)
  to authenticated;

grant select (id, booking_id, sender_context, body, created_at)
  on public.booking_messages to authenticated;
create policy booking_messages_authorized_read on public.booking_messages
for select to authenticated
using (
  public.can_receive_booking_chat_topic('booking:' || booking_id::text)
);

drop policy if exists booking_chat_broadcast_receive on realtime.messages;
drop policy if exists booking_chat_broadcast_guard on realtime.messages;
create policy booking_chat_broadcast_guard on realtime.messages
as restrictive
for select to authenticated
using (
  coalesce((select realtime.topic()) !~ '^booking:', false)
  or (
    realtime.messages.extension = 'broadcast'
    and public.can_receive_booking_chat_topic((select realtime.topic()))
  )
);
create policy booking_chat_broadcast_receive on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_receive_booking_chat_topic((select realtime.topic()))
);

-- Only the minimal relative-side payload leaves Postgres. Internal user IDs,
-- booking contact data, and provider identifiers never enter Realtime events.
create or replace function public.broadcast_booking_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'message', jsonb_build_object(
        'id', new.id::text,
        'text', new.body,
        'createdAt', round(extract(epoch from new.created_at) * 1000)::bigint,
        'senderContext', new.sender_context
      )
    ),
    'message_created',
    'booking:' || new.booking_id::text,
    true
  );
  return null;
end
$$;

revoke all on function public.broadcast_booking_message()
  from public, anon, authenticated;

create trigger booking_messages_realtime_broadcast
after insert on public.booking_messages
for each row execute function public.broadcast_booking_message();

commit;
