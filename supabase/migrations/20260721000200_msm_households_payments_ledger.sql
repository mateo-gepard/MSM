begin;

-- MSM owns household authorization, commercial facts, credit accounting, and the
-- booking lifecycle. External providers are integrations, never authorities for
-- money, entitlement, or application authorization.
create extension if not exists btree_gist;

do $$ begin
  create type public.household_membership_role as enum ('owner', 'guardian', 'viewer');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.membership_status as enum ('invited', 'active', 'revoked');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.offer_provider as enum ('stripe', 'legacy_manual');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_order_status as enum (
    'pending', 'checkout_created', 'processing', 'paid', 'failed', 'expired',
    'refunded', 'disputed'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.inbox_event_status as enum (
    'received', 'processing', 'processed', 'failed', 'ignored'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.credit_entry_kind as enum (
    'grant', 'reservation', 'consumption', 'release', 'cancellation_restore',
    'revocation', 'expiration', 'adjustment'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_lifecycle_status as enum (
    'provider_pending', 'pending_confirmation', 'scheduled', 'completed',
    'cancellation_pending', 'reschedule_pending', 'cancelled', 'failed'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_sync_status as enum (
    'pending', 'in_sync', 'needs_reconciliation', 'failed'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_credit_status as enum (
    'none', 'reserved', 'consumed', 'released', 'restored'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_operation_type as enum (
    'create', 'reschedule', 'cancel', 'reconcile'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_operation_status as enum (
    'queued', 'processing', 'succeeded', 'failed', 'ambiguous'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.booking_slot_claim_kind as enum (
    'booking', 'reschedule_hold'
  );
exception when duplicate_object then null;
end $$;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by_user_id uuid references auth.users(id) on delete set null,
  -- Set only by the migration. It makes legacy backfill deterministic without
  -- implying that future households are limited to one per creator.
  legacy_owner_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_membership_role not null,
  status public.membership_status not null default 'active',
  can_manage_learners boolean not null default false,
  can_book boolean not null default false,
  can_manage_billing boolean not null default false,
  can_view_all_bookings boolean not null default true,
  active_from timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_membership_one_record unique (household_id, user_id),
  constraint household_membership_status_time check (
    (status = 'revoked' and revoked_at is not null) or
    (status <> 'revoked' and revoked_at is null)
  ),
  constraint household_owner_permissions check (
    role <> 'owner' or
    (can_manage_learners and can_book and can_manage_billing and can_view_all_bookings)
  )
);
create index household_memberships_user_active_idx
  on public.household_memberships(user_id, household_id)
  where status = 'active' and revoked_at is null;

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  birth_date date,
  is_active boolean not null default true,
  is_legacy_placeholder boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_birth_date_not_future check (birth_date is null or birth_date <= current_date)
);
create index learners_household_active_idx on public.learners(household_id, is_active);

create table public.account_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  tutor_id uuid references public.tutors(id) on delete restrict,
  granted_by_user_id uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  reason text check (reason is null or char_length(reason) <= 500),
  constraint account_role_tutor_binding check (
    (role = 'tutor' and tutor_id is not null) or
    (role <> 'tutor' and tutor_id is null)
  )
);
create unique index account_roles_one_active_role
  on public.account_roles(user_id, role) where revoked_at is null;
create unique index account_roles_one_active_account_per_tutor
  on public.account_roles(tutor_id) where role = 'tutor' and revoked_at is null;

alter table public.profiles
  add column primary_household_id uuid references public.households(id) on delete set null,
  add column deactivated_at timestamptz;

-- An offer version is a sold commercial fact. Publishing a different price or
-- quantity means inserting a new version and moving the active_offers pointer.
create table public.offer_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete restrict,
  version integer not null check (version > 0),
  provider public.offer_provider not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  sessions integer not null check (sessions > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  stripe_product_id text,
  stripe_price_id text,
  stripe_livemode boolean,
  tax_behavior text check (tax_behavior in ('inclusive', 'exclusive', 'unspecified')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  constraint offer_version_number unique (package_id, version),
  constraint offer_version_package_identity unique (id, package_id),
  constraint offer_version_effective_window check (
    effective_until is null or effective_until > effective_from
  ),
  constraint offer_version_provider_mapping check (
    (provider = 'stripe' and stripe_product_id is not null and stripe_price_id is not null
      and stripe_livemode is not null) or
    (provider = 'legacy_manual' and stripe_product_id is null and stripe_price_id is null
      and stripe_livemode is null)
  )
);
create unique index offer_versions_stripe_price_unique
  on public.offer_versions(stripe_price_id) where stripe_price_id is not null;
create unique index offer_versions_stripe_product_price_unique
  on public.offer_versions(stripe_product_id, stripe_price_id)
  where stripe_product_id is not null and stripe_price_id is not null;

create table public.active_offers (
  package_id uuid primary key references public.packages(id) on delete cascade,
  offer_version_id uuid not null unique references public.offer_versions(id) on delete restrict,
  checkout_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  constraint active_offer_version_package_fk
    foreign key (offer_version_id, package_id)
    references public.offer_versions(id, package_id) on delete restrict
);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  offer_version_id uuid not null references public.offer_versions(id) on delete restrict,
  package_purchase_id uuid unique,
  provider public.offer_provider not null default 'stripe',
  status public.payment_order_status not null default 'pending',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_cents integer not null check (amount_cents >= 0),
  paid_total_cents integer check (paid_total_cents is null or paid_total_cents >= 0),
  tax_cents integer check (tax_cents is null or tax_cents >= 0),
  quantity integer not null default 1 check (quantity = 1),
  client_idempotency_key text not null check (char_length(client_idempotency_key) between 1 and 200),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  livemode boolean,
  provider_created_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  failed_at timestamptz,
  expired_at timestamptz,
  refunded_at timestamptz,
  failure_code text,
  failure_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_order_user_idempotency unique (user_id, client_idempotency_key),
  constraint payment_order_failure_detail_limit check (
    failure_detail is null or char_length(failure_detail) <= 2000
  )
);
create index payment_orders_household_created_idx
  on public.payment_orders(household_id, created_at desc);
create index payment_orders_status_idx on public.payment_orders(status, updated_at);

create table public.stripe_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  api_version text,
  object_created_at timestamptz,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payment_order_id uuid references public.payment_orders(id) on delete restrict,
  effect_type text check (
    effect_type is null or effect_type in ('checkout_fulfillment', 'checkout_failure', 'refund', 'dispute')
  ),
  effect_reference text,
  status public.inbox_event_status not null default 'received',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  constraint stripe_event_effect_binding check (
    (payment_order_id is null and effect_type is null and effect_reference is null) or
    (payment_order_id is not null and effect_type is not null and effect_reference is not null)
  )
);
create index stripe_events_processing_idx on public.stripe_events(status, received_at);

create table public.api_rate_limit_buckets (
  scope text not null check (char_length(scope) between 1 and 80),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);
create index api_rate_limit_buckets_retention_idx
  on public.api_rate_limit_buckets(updated_at);

alter table public.bookings
  add column household_id uuid references public.households(id) on delete restrict,
  add column learner_id uuid references public.learners(id) on delete restrict,
  add column created_by_user_id uuid references auth.users(id) on delete restrict,
  add column idempotency_key text,
  add column ends_at timestamptz,
  add column lifecycle_status public.booking_lifecycle_status,
  add column sync_status public.booking_sync_status not null default 'in_sync',
  add column credit_status public.booking_credit_status not null default 'none',
  add column credit_grant_id uuid,
  add column scheduling_provider text not null default 'calcom',
  add column provider_booking_id text,
  add column provider_status text,
  add column provider_revision integer not null default 0 check (provider_revision >= 0),
  add column provider_last_synced_at timestamptz,
  add column reconciliation_checked_at timestamptz,
  add column meeting_url text,
  add column row_version integer not null default 1 check (row_version > 0),
  add column reconciliation_reason text;

create table public.booking_operations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  operation_type public.booking_operation_type not null,
  status public.booking_operation_status not null default 'queued',
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  expected_booking_version integer not null check (expected_booking_version > 0),
  previous_lifecycle_status public.booking_lifecycle_status,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_time_zone text,
  reason text check (reason is null or char_length(reason) <= 500),
  -- Canonical application request facts are immutable. In particular, create
  -- retries must never compare against bookings.starts_at after a reschedule.
  request_facts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_facts) = 'object'),
  provider text not null default 'calcom',
  provider_booking_id_before text,
  provider_booking_id_after text,
  provider_response jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_unchanged_check_count integer not null default 0
    check (provider_unchanged_check_count >= 0),
  provider_unchanged_last_checked_at timestamptz,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_detail text check (last_error_detail is null or char_length(last_error_detail) <= 2000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint booking_operation_idempotency unique (idempotency_key),
  constraint booking_operation_booking_identity unique (id, booking_id)
);
create index booking_operations_work_queue_idx
  on public.booking_operations(status, next_attempt_at, created_at)
  where status in ('queued', 'ambiguous');
create unique index booking_operations_one_live_mutation
  on public.booking_operations(booking_id)
  where status in ('queued', 'processing', 'ambiguous');

-- Every active booking has a canonical claim and every local reschedule has a
-- second, operation-bound target hold. Keeping both kinds in one exclusion
-- domain means a concurrent create or reschedule cannot pass a precheck and
-- race the outbound Cal.com mutation. Claims belonging to the same booking may
-- overlap so a lesson can move by less than its own duration.
create table public.booking_slot_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  operation_id uuid unique,
  tutor_id uuid not null references public.tutors(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  claim_kind public.booking_slot_claim_kind not null,
  released_at timestamptz,
  release_reason text check (release_reason is null or char_length(release_reason) <= 200),
  created_at timestamptz not null default now(),
  constraint booking_slot_claim_positive_interval check (ends_at > starts_at),
  constraint booking_slot_claim_operation_shape check (
    (claim_kind = 'booking' and operation_id is null)
    or (claim_kind = 'reschedule_hold' and operation_id is not null)
  ),
  constraint booking_slot_claim_operation_booking_fk
    foreign key (operation_id, booking_id)
    references public.booking_operations(id, booking_id) on delete restrict,
  constraint booking_slot_claim_release_shape check (
    (released_at is null and release_reason is null)
    or (released_at is not null and release_reason is not null)
  )
);
create unique index booking_slot_claims_one_active_booking
  on public.booking_slot_claims(booking_id)
  where claim_kind = 'booking' and released_at is null;
alter table public.booking_slot_claims
  add constraint booking_slot_claims_no_overlap
  exclude using gist (
    tutor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&,
    booking_id with <>
  ) where (released_at is null);

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  booking_id uuid references public.bookings(id) on delete restrict,
  provider_booking_id text,
  occurred_at timestamptz,
  payload jsonb not null,
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  status public.inbox_event_status not null default 'received',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  constraint provider_event_unique unique (provider, provider_event_id)
);
create index provider_events_processing_idx
  on public.provider_events(status, received_at);
create index provider_events_booking_idx on public.provider_events(booking_id, occurred_at);

create table public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  unit text not null default 'lesson' check (unit = 'lesson'),
  available_balance integer not null default 0 check (available_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_account_one_unit unique (household_id, unit)
);

create table public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts(id) on delete restrict,
  payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  package_purchase_id uuid unique references public.package_purchases(id) on delete restrict,
  offer_version_id uuid not null references public.offer_versions(id) on delete restrict,
  granted_quantity integer not null check (granted_quantity > 0),
  valid_from timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credit_grant_validity check (expires_at is null or expires_at > valid_from),
  constraint credit_grant_has_origin check (
    payment_order_id is not null or package_purchase_id is not null
  )
);
create index credit_grants_account_validity_idx
  on public.credit_grants(credit_account_id, valid_from, expires_at);

alter table public.bookings
  add constraint bookings_credit_grant_fk foreign key (credit_grant_id)
    references public.credit_grants(id) on delete restrict;

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts(id) on delete restrict,
  credit_grant_id uuid not null references public.credit_grants(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  entry_kind public.credit_entry_kind not null,
  delta integer not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 240),
  source_type text not null check (char_length(source_type) between 1 and 80),
  source_id text not null check (char_length(source_id) between 1 and 240),
  source_action text not null check (char_length(source_action) between 1 and 80),
  reverses_entry_id uuid unique references public.credit_ledger(id) on delete restrict,
  stripe_event_id text references public.stripe_events(event_id) on delete restrict,
  provider_event_id uuid references public.provider_events(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  constraint credit_ledger_idempotency unique (idempotency_key),
  constraint credit_ledger_source_unique unique (source_type, source_id, source_action),
  constraint credit_ledger_kind_delta check (
    (entry_kind = 'grant' and delta > 0) or
    (entry_kind = 'reservation' and delta = -1) or
    (entry_kind = 'consumption' and delta = 0) or
    (entry_kind in ('release', 'cancellation_restore') and delta = 1) or
    (entry_kind in ('revocation', 'expiration') and delta < 0) or
    (entry_kind = 'adjustment' and delta <> 0)
  ),
  constraint credit_ledger_booking_shape check (
    (entry_kind in ('reservation', 'consumption', 'release', 'cancellation_restore')
      and booking_id is not null) or
    (entry_kind not in ('reservation', 'consumption', 'release', 'cancellation_restore'))
  ),
  constraint credit_ledger_no_self_reverse check (reverses_entry_id is null or reverses_entry_id <> id)
);
create index credit_ledger_account_created_idx
  on public.credit_ledger(credit_account_id, created_at, id);
create index credit_ledger_grant_created_idx
  on public.credit_ledger(credit_grant_id, created_at, id);
create unique index credit_ledger_booking_reservation_unique
  on public.credit_ledger(booking_id) where entry_kind = 'reservation';
create unique index credit_ledger_booking_consumption_unique
  on public.credit_ledger(booking_id) where entry_kind = 'consumption';
create unique index credit_ledger_booking_release_unique
  on public.credit_ledger(booking_id) where entry_kind = 'release';
create unique index credit_ledger_booking_restore_unique
  on public.credit_ledger(booking_id) where entry_kind = 'cancellation_restore';

alter table public.bookings
  add column credit_reservation_entry_id uuid unique references public.credit_ledger(id) on delete restrict;

alter table public.package_purchases
  add column household_id uuid references public.households(id) on delete restrict,
  add column offer_version_id uuid references public.offer_versions(id) on delete restrict,
  add column payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  add column credit_grant_id uuid unique references public.credit_grants(id) on delete restrict;

alter table public.payment_orders
  add constraint payment_orders_package_purchase_fk
  foreign key (package_purchase_id) references public.package_purchases(id) on delete restrict;

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  stripe_event_id text not null references public.stripe_events(event_id) on delete restrict,
  stripe_refund_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null,
  reason text,
  provider_created_at timestamptz,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_refunds_order_idx on public.payment_refunds(payment_order_id, created_at);

create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  stripe_event_id text not null references public.stripe_events(event_id) on delete restrict,
  stripe_dispute_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_disputes_order_idx on public.payment_disputes(payment_order_id, created_at);

create table public.booking_audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  operation_id uuid references public.booking_operations(id) on delete restrict,
  provider_event_id uuid references public.provider_events(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 100),
  actor_kind text not null check (actor_kind in ('user', 'system', 'provider', 'migration')),
  actor_user_id uuid references auth.users(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index booking_audit_booking_idx on public.booking_audit_log(booking_id, created_at, id);

comment on table public.offer_versions is
  'Immutable snapshots of package terms. Never update or delete; publish a new version.';
comment on table public.credit_ledger is
  'Append-only lesson-credit journal. available_balance is a locked projection of SUM(delta).';
comment on column public.bookings.idempotency_key is
  'Stable application request key; retries return the original booking and operation.';
comment on table public.stripe_events is
  'Signature-verified Stripe webhook inbox. Rows are retained for replay and audit.';
comment on table public.provider_events is
  'Signature-verified scheduling-provider webhook inbox. Processing is replay-safe.';

-- Keep timestamps and projections inside the database even when a trusted API
-- performs the write.
drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at before update on public.households
for each row execute function public.set_updated_at();
drop trigger if exists household_memberships_set_updated_at on public.household_memberships;
create trigger household_memberships_set_updated_at before update on public.household_memberships
for each row execute function public.set_updated_at();
drop trigger if exists learners_set_updated_at on public.learners;
create trigger learners_set_updated_at before update on public.learners
for each row execute function public.set_updated_at();
drop trigger if exists active_offers_set_updated_at on public.active_offers;
create trigger active_offers_set_updated_at before update on public.active_offers
for each row execute function public.set_updated_at();
drop trigger if exists payment_orders_set_updated_at on public.payment_orders;
create trigger payment_orders_set_updated_at before update on public.payment_orders
for each row execute function public.set_updated_at();
drop trigger if exists booking_operations_set_updated_at on public.booking_operations;
create trigger booking_operations_set_updated_at before update on public.booking_operations
for each row execute function public.set_updated_at();
drop trigger if exists credit_accounts_set_updated_at on public.credit_accounts;
create trigger credit_accounts_set_updated_at before update on public.credit_accounts
for each row execute function public.set_updated_at();
drop trigger if exists payment_refunds_set_updated_at on public.payment_refunds;
create trigger payment_refunds_set_updated_at before update on public.payment_refunds
for each row execute function public.set_updated_at();
drop trigger if exists payment_disputes_set_updated_at on public.payment_disputes;
create trigger payment_disputes_set_updated_at before update on public.payment_disputes
for each row execute function public.set_updated_at();

create or replace function public.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '% is append-only/immutable', tg_table_name using errcode = '55000';
end
$$;

create trigger offer_versions_immutable
before update or delete on public.offer_versions
for each row execute function public.reject_immutable_mutation();
create trigger credit_grants_immutable
before update or delete on public.credit_grants
for each row execute function public.reject_immutable_mutation();
create trigger credit_ledger_append_only
before update or delete on public.credit_ledger
for each row execute function public.reject_immutable_mutation();
create trigger booking_audit_append_only
before update or delete on public.booking_audit_log
for each row execute function public.reject_immutable_mutation();

create or replace function public.protect_booking_operation_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.booking_id <> old.booking_id
     or new.operation_type <> old.operation_type
     or new.idempotency_key <> old.idempotency_key
     or new.requested_by_user_id is distinct from old.requested_by_user_id
     or new.expected_booking_version <> old.expected_booking_version
     or new.previous_lifecycle_status is distinct from old.previous_lifecycle_status
     or new.requested_starts_at is distinct from old.requested_starts_at
     or new.requested_ends_at is distinct from old.requested_ends_at
     or new.requested_time_zone is distinct from old.requested_time_zone
     or new.reason is distinct from old.reason
     or new.request_facts <> old.request_facts
     or new.provider <> old.provider
     or new.provider_booking_id_before is distinct from old.provider_booking_id_before
     or new.created_at <> old.created_at then
    raise exception 'BOOKING_OPERATION_REQUEST_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end
$$;
create trigger booking_operations_protect_request
before update on public.booking_operations
for each row execute function public.protect_booking_operation_request();

create or replace function public.protect_booking_slot_claim()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.booking_id <> old.booking_id
     or new.operation_id is distinct from old.operation_id
     or new.claim_kind <> old.claim_kind
     or (
       old.claim_kind = 'reschedule_hold'
       and (
         new.tutor_id <> old.tutor_id
         or new.starts_at <> old.starts_at
         or new.ends_at <> old.ends_at
       )
     )
     or (
       old.released_at is not null
       and (
         new.released_at is distinct from old.released_at
         or new.release_reason is distinct from old.release_reason
       )
     ) then
    raise exception 'BOOKING_SLOT_CLAIM_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end
$$;
create trigger booking_slot_claims_protect
before update on public.booking_slot_claims
for each row execute function public.protect_booking_slot_claim();

create or replace function public.validate_booking_slot_claim()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.claim_kind = 'booking' and new.released_at is null then
    if not exists (
      select 1
      from public.bookings b
      where b.id = new.booking_id
        and b.tutor_id = new.tutor_id
        and b.starts_at = new.starts_at
        and b.ends_at = new.ends_at
        and b.lifecycle_status in (
          'provider_pending', 'pending_confirmation', 'scheduled',
          'cancellation_pending', 'reschedule_pending'
        )
    ) then
      raise exception 'BOOKING_SLOT_CLAIM_BOOKING_MISMATCH' using errcode = '23514';
    end if;
  elsif new.claim_kind = 'reschedule_hold' then
    if not exists (
      select 1
      from public.booking_operations bo
      join public.bookings b on b.id = bo.booking_id
      where bo.id = new.operation_id
        and bo.booking_id = new.booking_id
        and bo.operation_type = 'reschedule'
        and bo.requested_starts_at = new.starts_at
        and bo.requested_ends_at = new.ends_at
        and b.tutor_id = new.tutor_id
        and (
          new.released_at is not null
          or (
            bo.status in ('queued', 'processing', 'ambiguous')
            and b.lifecycle_status = 'reschedule_pending'
          )
        )
    ) then
      raise exception 'BOOKING_SLOT_HOLD_OPERATION_MISMATCH' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
create trigger booking_slot_claims_validate
before insert or update on public.booking_slot_claims
for each row execute function public.validate_booking_slot_claim();

create or replace function public.sync_booking_slot_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lifecycle_status in (
       'provider_pending', 'pending_confirmation', 'scheduled',
       'cancellation_pending', 'reschedule_pending'
     ) then
    update public.booking_slot_claims
    set tutor_id = new.tutor_id,
        starts_at = new.starts_at,
        ends_at = new.ends_at
    where booking_id = new.id
      and claim_kind = 'booking'
      and released_at is null;
    if not found then
      insert into public.booking_slot_claims (
        booking_id, tutor_id, starts_at, ends_at, claim_kind
      ) values (
        new.id, new.tutor_id, new.starts_at, new.ends_at, 'booking'
      );
    end if;
  else
    update public.booking_slot_claims
    set released_at = coalesce(released_at, now()),
        release_reason = coalesce(release_reason, 'BOOKING_TERMINAL')
    where booking_id = new.id
      and claim_kind = 'booking'
      and released_at is null;
  end if;
  return new;
end
$$;

create or replace function public.protect_payment_order_commercial_facts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.household_id <> old.household_id
     or new.user_id <> old.user_id
     or new.offer_version_id <> old.offer_version_id
     or new.provider <> old.provider
     or new.currency <> old.currency
     or new.amount_cents <> old.amount_cents
     or new.quantity <> old.quantity
     or new.client_idempotency_key <> old.client_idempotency_key
     or (old.paid_total_cents is not null
         and new.paid_total_cents is distinct from old.paid_total_cents)
     or (old.tax_cents is not null and new.tax_cents is distinct from old.tax_cents) then
    raise exception 'PAYMENT_ORDER_COMMERCIAL_FACTS_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end
$$;
create trigger payment_orders_protect_commercial_facts
before update on public.payment_orders
for each row execute function public.protect_payment_order_commercial_facts();

create or replace function public.protect_stripe_event_payload()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_id <> old.event_id
     or new.event_type <> old.event_type
     or new.livemode <> old.livemode
     or new.payload <> old.payload
     or new.payload_sha256 <> old.payload_sha256 then
    raise exception 'STRIPE_EVENT_ENVELOPE_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end
$$;
create trigger stripe_events_protect_envelope
before update on public.stripe_events
for each row execute function public.protect_stripe_event_payload();

create or replace function public.protect_provider_event_payload()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.provider <> old.provider
     or new.provider_event_id <> old.provider_event_id
     or new.event_type <> old.event_type
     or new.payload <> old.payload
     or new.payload_sha256 is distinct from old.payload_sha256 then
    raise exception 'PROVIDER_EVENT_ENVELOPE_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end
$$;
create trigger provider_events_protect_envelope
before update on public.provider_events
for each row execute function public.protect_provider_event_payload();

create or replace function public.maintain_booking_projection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.ends_at := new.starts_at + (new.duration_minutes * interval '1 minute');
  new.provider_booking_id := coalesce(new.provider_booking_id, new.calcom_booking_uid);
  new.calcom_booking_uid := coalesce(new.calcom_booking_uid, new.provider_booking_id);

  if new.lifecycle_status = 'cancelled' then
    new.status := 'cancelled';
    new.cancelled_at := coalesce(new.cancelled_at, now());
  elsif new.lifecycle_status = 'completed' then
    new.status := 'completed';
  else
    -- Compatibility projection for the pre-ledger server API.
    new.status := 'scheduled';
  end if;

  if tg_op = 'UPDATE' then
    new.row_version := old.row_version + 1;
  end if;
  return new;
end
$$;
drop trigger if exists bookings_maintain_projection on public.bookings;
create trigger bookings_maintain_projection
before insert or update on public.bookings
for each row execute function public.maintain_booking_projection();

create or replace function public.apply_credit_ledger_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_account uuid;
  v_grant_balance integer;
begin
  select credit_account_id into v_grant_account
  from public.credit_grants where id = new.credit_grant_id for update;
  if v_grant_account is distinct from new.credit_account_id then
    raise exception 'CREDIT_GRANT_ACCOUNT_MISMATCH' using errcode = '23514';
  end if;

  select coalesce(sum(delta), 0)::integer into v_grant_balance
  from public.credit_ledger where credit_grant_id = new.credit_grant_id;
  if v_grant_balance < 0 then
    raise exception 'CREDIT_GRANT_OVERDRAWN' using errcode = '23514';
  end if;

  update public.credit_accounts
  set available_balance = available_balance + new.delta
  where id = new.credit_account_id
    and available_balance + new.delta >= 0;
  if not found then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger credit_ledger_apply_balance
after insert on public.credit_ledger
for each row execute function public.apply_credit_ledger_balance();

create or replace function public.assert_credit_account_projection()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ledger_balance integer;
begin
  select coalesce(sum(delta), 0)::integer into v_ledger_balance
  from public.credit_ledger where credit_account_id = new.id;
  if new.available_balance <> v_ledger_balance then
    raise exception 'CREDIT_ACCOUNT_PROJECTION_MISMATCH' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger credit_accounts_assert_projection
after insert or update of available_balance on public.credit_accounts
for each row execute function public.assert_credit_account_projection();

-- New provider-first rows must be allowed to exist before an external UID or
-- event-type ID has been allocated.
alter table public.bookings alter column calcom_booking_uid drop not null;
alter table public.bookings alter column calcom_event_type_id drop not null;

-- Backfill one household for every existing customer-like account. Tutors with
-- no historic household activity remain household-less rather than inventing a
-- family relationship.
insert into public.households (name, created_by_user_id, legacy_owner_user_id)
select
  left(coalesce(nullif(trim(p.display_name), '') || '''s household', 'Household'), 120),
  p.id,
  p.id
from public.profiles p
where p.role in ('parent', 'admin')
   or exists (select 1 from public.package_purchases pp where pp.user_id = p.id)
   or exists (select 1 from public.bookings b where b.user_id = p.id)
on conflict (legacy_owner_user_id) do nothing;

insert into public.household_memberships (
  household_id, user_id, role, status, can_manage_learners, can_book,
  can_manage_billing, can_view_all_bookings, active_from
)
select h.id, h.legacy_owner_user_id, 'owner', 'active', true, true, true, true, h.created_at
from public.households h
where h.legacy_owner_user_id is not null
on conflict (household_id, user_id) do nothing;

update public.profiles p
set primary_household_id = h.id
from public.households h
where h.legacy_owner_user_id = p.id
  and p.primary_household_id is null;

insert into public.account_roles (user_id, role, tutor_id, granted_at, reason)
select p.id, p.role, p.tutor_id, p.created_at, 'Foundation profile role backfill'
from public.profiles p
on conflict (user_id, role) where revoked_at is null do nothing;

-- A placeholder is explicit uncertainty, not a guessed child identity. It can be
-- replaced through the household API after a guardian reviews legacy bookings.
insert into public.learners (
  household_id, display_name, is_legacy_placeholder, created_by_user_id, created_at
)
select h.id, 'Legacy learner - assignment required', true, h.legacy_owner_user_id,
       min(b.created_at)
from public.households h
join public.bookings b on b.user_id = h.legacy_owner_user_id
group by h.id, h.legacy_owner_user_id
on conflict do nothing;

insert into public.offer_versions (
  package_id, version, provider, name, sessions, amount_cents, currency,
  effective_from, created_at
)
select p.id, 1, 'legacy_manual', left(coalesce(nullif(trim(p.name), ''), 'Legacy package'), 160),
       p.sessions, p.price_cents, 'EUR',
       p.created_at, p.created_at
from public.packages p
on conflict (package_id, version) do nothing;

insert into public.active_offers (package_id, offer_version_id, checkout_enabled)
select ov.package_id, ov.id, false
from public.offer_versions ov
where ov.version = 1 and ov.provider = 'legacy_manual'
on conflict (package_id) do nothing;

-- The foundation accepted an empty legacy reference as "verified". Empty text
-- is not payment evidence, so fail those rows closed before granting/backfilling
-- any spendable value. Non-empty already-verified rows are preserved as-is.
update public.package_purchases
set payment_status = 'unverified'
where payment_status = 'verified'
  and nullif(trim(payment_reference), '') is null;
alter table public.package_purchases
  add constraint package_purchases_verified_reference_nonempty check (
    payment_status <> 'verified' or nullif(trim(payment_reference), '') is not null
  );

update public.package_purchases pp
set household_id = h.id,
    offer_version_id = ov.id
from public.households h, public.offer_versions ov
where h.legacy_owner_user_id = pp.user_id
  and ov.package_id = pp.package_id
  and ov.version = 1
  and pp.household_id is null;

insert into public.payment_orders (
  household_id, user_id, offer_version_id, package_purchase_id, provider, status,
  currency, amount_cents, client_idempotency_key, provider_created_at, paid_at,
  fulfilled_at, refunded_at, created_at, updated_at
)
select
  pp.household_id,
  pp.user_id,
  pp.offer_version_id,
  pp.id,
  'legacy_manual',
  case pp.payment_status
    when 'verified' then 'paid'::public.payment_order_status
    when 'refunded' then 'refunded'::public.payment_order_status
    else 'pending'::public.payment_order_status
  end,
  'EUR',
  pp.price_paid_cents,
  'legacy:purchase:' || pp.id::text,
  pp.created_at,
  case when pp.payment_status = 'verified' then pp.created_at end,
  case when pp.payment_status = 'verified' then pp.created_at end,
  case when pp.payment_status = 'refunded' then coalesce(pp.completed_at, pp.updated_at) end,
  pp.created_at,
  pp.updated_at
from public.package_purchases pp
where pp.household_id is not null and pp.offer_version_id is not null
on conflict (user_id, client_idempotency_key) do nothing;

update public.package_purchases pp
set payment_order_id = po.id
from public.payment_orders po
where po.package_purchase_id = pp.id
  and pp.payment_order_id is null;

insert into public.credit_accounts (household_id)
select h.id from public.households h
on conflict (household_id, unit) do nothing;

insert into public.credit_grants (
  credit_account_id, payment_order_id, package_purchase_id, offer_version_id,
  granted_quantity, valid_from, created_at
)
select ca.id, pp.payment_order_id, pp.id, pp.offer_version_id,
       pp.total_sessions, pp.created_at, pp.created_at
from public.package_purchases pp
join public.credit_accounts ca on ca.household_id = pp.household_id
where pp.payment_status = 'verified'
on conflict (package_purchase_id) do nothing;

update public.package_purchases pp
set credit_grant_id = cg.id
from public.credit_grants cg
where cg.package_purchase_id = pp.id
  and pp.credit_grant_id is null;

insert into public.credit_ledger (
  credit_account_id, credit_grant_id, entry_kind, delta, idempotency_key,
  source_type, source_id, source_action, note, created_at
)
select cg.credit_account_id, cg.id, 'grant', cg.granted_quantity,
       'legacy:grant:' || cg.package_purchase_id::text,
       'package_purchase', cg.package_purchase_id::text, 'grant',
       'Backfilled from a payment-verified package purchase', cg.created_at
from public.credit_grants cg
where cg.package_purchase_id is not null
on conflict (idempotency_key) do nothing;

update public.bookings b
set household_id = h.id,
    learner_id = l.id,
    created_by_user_id = b.user_id,
    idempotency_key = 'legacy:booking:' || b.id::text,
    ends_at = b.starts_at + (b.duration_minutes * interval '1 minute'),
    lifecycle_status = case b.status
      when 'cancelled' then 'cancelled'::public.booking_lifecycle_status
      when 'completed' then 'completed'::public.booking_lifecycle_status
      else 'scheduled'::public.booking_lifecycle_status
    end,
    sync_status = 'in_sync',
    provider_booking_id = b.calcom_booking_uid,
    provider_status = b.status::text,
    provider_last_synced_at = b.updated_at,
    credit_status = 'none'
from public.households h
join public.learners l
  on l.household_id = h.id and l.is_legacy_placeholder
where h.legacy_owner_user_id = b.user_id;

update public.bookings b
set credit_grant_id = cg.id,
    credit_status = case
      when b.status = 'cancelled' then 'restored'::public.booking_credit_status
      else 'consumed'::public.booking_credit_status
    end
from public.credit_grants cg
where cg.package_purchase_id = b.package_purchase_id;

-- The broad LEFT JOIN above intentionally maps paid bookings only to their own
-- grant. Ensure trial rows that have no purchase remain grant-free.
update public.bookings
set credit_grant_id = null, credit_status = 'none'
where package_purchase_id is null;

insert into public.credit_ledger (
  credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
  idempotency_key, source_type, source_id, source_action, note, created_at
)
select cg.credit_account_id, cg.id, b.id, 'reservation', -1,
       'legacy:booking:' || b.id::text || ':reserve',
       'booking', b.id::text, 'reserve', 'Legacy consumed-credit reservation', b.created_at
from public.bookings b
join public.credit_grants cg on cg.id = b.credit_grant_id
where b.status <> 'cancelled'
on conflict (idempotency_key) do nothing;

insert into public.credit_ledger (
  credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
  idempotency_key, source_type, source_id, source_action, note, created_at
)
select cg.credit_account_id, cg.id, b.id, 'consumption', 0,
       'legacy:booking:' || b.id::text || ':confirm',
       'booking', b.id::text, 'confirm', 'Legacy booking credit consumption', b.created_at
from public.bookings b
join public.credit_grants cg on cg.id = b.credit_grant_id
where b.status <> 'cancelled'
on conflict (idempotency_key) do nothing;

update public.bookings b
set credit_reservation_entry_id = cl.id
from public.credit_ledger cl
where cl.booking_id = b.id and cl.entry_kind = 'reservation';

-- Preserve the old remaining_sessions projection exactly. Any historic manual
-- consumption not represented by a booking becomes a visible migration entry.
insert into public.credit_ledger (
  credit_account_id, credit_grant_id, entry_kind, delta, idempotency_key,
  source_type, source_id, source_action, note
)
select cg.credit_account_id, cg.id, 'adjustment',
       pp.remaining_sessions - coalesce(sum(cl.delta), 0)::integer,
       'legacy:purchase:' || pp.id::text || ':balance-adjustment',
       'package_purchase', pp.id::text, 'balance_adjustment',
       'Reconciles the ledger to the reviewed legacy remaining_sessions projection'
from public.package_purchases pp
join public.credit_grants cg on cg.package_purchase_id = pp.id
left join public.credit_ledger cl on cl.credit_grant_id = cg.id
group by cg.credit_account_id, cg.id, pp.id, pp.remaining_sessions
having pp.remaining_sessions <> coalesce(sum(cl.delta), 0)::integer;

insert into public.booking_audit_log (
  booking_id, action, actor_kind, before_state, after_state, created_at
)
select b.id, 'legacy_backfill', 'migration', null,
       jsonb_build_object(
         'lifecycle_status', b.lifecycle_status,
         'sync_status', b.sync_status,
         'credit_status', b.credit_status,
         'legacy_user_id', b.user_id
       ),
       b.updated_at
from public.bookings b;

do $$
begin
  if exists (
    select 1 from public.package_purchases
    where household_id is null or offer_version_id is null or payment_order_id is null
  ) then
    raise exception 'PACKAGE_PURCHASE_BACKFILL_INCOMPLETE';
  end if;
  if exists (
    select 1 from public.bookings
    where household_id is null or learner_id is null or created_by_user_id is null
       or idempotency_key is null or ends_at is null or lifecycle_status is null
  ) then
    raise exception 'BOOKING_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.package_purchases
  alter column household_id set not null,
  alter column offer_version_id set not null,
  alter column payment_order_id set not null;
alter table public.bookings
  alter column household_id set not null,
  alter column learner_id set not null,
  alter column created_by_user_id set not null,
  alter column idempotency_key set not null,
  alter column ends_at set not null,
  alter column lifecycle_status set not null;

alter table public.learners
  add constraint learners_household_identity unique (id, household_id);
alter table public.package_purchases
  add constraint package_purchases_booking_identity
  unique (id, package_id, household_id),
  add constraint package_purchases_offer_identity unique (id, offer_version_id),
  add constraint package_purchases_offer_package_fk
  foreign key (offer_version_id, package_id)
  references public.offer_versions(id, package_id) on delete restrict;
alter table public.payment_orders
  add constraint payment_orders_offer_identity unique (id, offer_version_id),
  add constraint payment_orders_purchase_offer_fk
  foreign key (package_purchase_id, offer_version_id)
  references public.package_purchases(id, offer_version_id) on delete restrict;
alter table public.package_purchases
  add constraint package_purchases_order_offer_fk
  foreign key (payment_order_id, offer_version_id)
  references public.payment_orders(id, offer_version_id) on delete restrict;
alter table public.credit_grants
  add constraint credit_grants_purchase_offer_fk
  foreign key (package_purchase_id, offer_version_id)
  references public.package_purchases(id, offer_version_id) on delete restrict,
  add constraint credit_grants_order_offer_fk
  foreign key (payment_order_id, offer_version_id)
  references public.payment_orders(id, offer_version_id) on delete restrict;
alter table public.bookings
  add constraint bookings_learner_household_fk
  foreign key (learner_id, household_id)
  references public.learners(id, household_id) on delete restrict,
  add constraint bookings_purchase_identity_fk
  foreign key (package_purchase_id, package_id, household_id)
  references public.package_purchases(id, package_id, household_id)
  on delete restrict,
  add constraint bookings_positive_interval check (ends_at > starts_at),
  add constraint bookings_idempotency_unique unique (idempotency_key),
  add constraint bookings_provider_identity_consistent check (
    provider_booking_id is null or calcom_booking_uid is null or
    provider_booking_id = calcom_booking_uid
  );
create unique index bookings_provider_booking_unique
  on public.bookings(scheduling_provider, provider_booking_id)
  where provider_booking_id is not null;
create index bookings_reconciliation_queue_idx
  on public.bookings(reconciliation_checked_at, updated_at)
  where sync_status in ('pending', 'needs_reconciliation')
     or lifecycle_status in (
       'provider_pending', 'pending_confirmation', 'cancellation_pending',
       'reschedule_pending'
     );

drop index if exists public.bookings_one_scheduled_tutor_slot;
drop index if exists public.bookings_one_trial_per_user;
create unique index bookings_one_trial_per_household
  on public.bookings(household_id)
  where package_id = 'a497cc91-10a1-5ac1-9000-000000000001'::uuid
    and lifecycle_status <> 'failed';

-- Refuse to silently reinterpret conflicting historic appointments. Operators
-- must reconcile any conflict before the exclusion invariant can be installed.
do $$
begin
  if exists (
    select 1
    from public.bookings a
    join public.bookings b
      on a.id < b.id
     and a.tutor_id = b.tutor_id
     and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
    where a.lifecycle_status in (
            'provider_pending', 'pending_confirmation', 'scheduled',
            'cancellation_pending', 'reschedule_pending'
          )
      and b.lifecycle_status in (
            'provider_pending', 'pending_confirmation', 'scheduled',
            'cancellation_pending', 'reschedule_pending'
          )
  ) then
    raise exception 'LEGACY_BOOKING_OVERLAP_REQUIRES_RECONCILIATION';
  end if;
end
$$;

alter table public.bookings
  add constraint bookings_tutor_time_no_overlap
  exclude using gist (
    tutor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (lifecycle_status in (
    'provider_pending', 'pending_confirmation', 'scheduled',
    'cancellation_pending', 'reschedule_pending'
  ));

insert into public.booking_slot_claims (
  booking_id, tutor_id, starts_at, ends_at, claim_kind
)
select b.id, b.tutor_id, b.starts_at, b.ends_at, 'booking'
from public.bookings b
where b.lifecycle_status in (
  'provider_pending', 'pending_confirmation', 'scheduled',
  'cancellation_pending', 'reschedule_pending'
);

create trigger bookings_sync_slot_claim
after insert or update of tutor_id, starts_at, duration_minutes, lifecycle_status
on public.bookings
for each row execute function public.sync_booking_slot_claim();

create or replace function public.has_active_account_role(
  p_user_id uuid,
  p_role public.user_role,
  p_tutor_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_roles ar
    join public.profiles p on p.id = ar.user_id
    where ar.user_id = p_user_id
      and ar.role = p_role
      and ar.revoked_at is null
      and p.deactivated_at is null
      and (p_tutor_id is null or ar.tutor_id = p_tutor_id)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and public.has_active_account_role(auth.uid(), 'admin', null);
$$;

create or replace function public.is_assigned_tutor(p_tutor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and public.has_active_account_role(auth.uid(), 'tutor', p_tutor_id);
$$;

create or replace function public.has_household_permission_for_user(
  p_user_id uuid,
  p_household_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_account_role(p_user_id, 'admin', null)
    or exists (
      select 1
      from public.household_memberships hm
      join public.profiles p on p.id = hm.user_id
      where hm.user_id = p_user_id
        and hm.household_id = p_household_id
        and hm.status = 'active'
        and hm.revoked_at is null
        and hm.active_from <= now()
        and p.deactivated_at is null
        and case p_permission
          when 'view' then true
          when 'manage_learners' then hm.can_manage_learners
          when 'book' then hm.can_book
          when 'manage_billing' then hm.can_manage_billing
          when 'view_all_bookings' then hm.can_view_all_bookings
          else false
        end
    );
$$;

create or replace function public.has_household_permission(
  p_household_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_household_permission_for_user(auth.uid(), p_household_id, p_permission);
$$;

-- Count inactive and legacy rows as well as active learners. Learners remain
-- referenced by booking history, so deactivation must not become a way to grow
-- a household without bound. The transaction-scoped lock closes concurrent
-- count-then-insert races across every service-role insertion path.
create or replace function public.enforce_household_learner_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('household-learner-limit:' || new.household_id::text, 0)
  );
  if (
    select count(*) >= 25
    from public.learners
    where household_id = new.household_id
  ) then
    raise exception 'HOUSEHOLD_LEARNER_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger learners_enforce_household_limit
before insert on public.learners
for each row execute function public.enforce_household_learner_limit();

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  if nullif(trim(p_scope), '') is null
     or char_length(p_scope) > 80
     or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit not between 1 and 10000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rate-limit:' || p_scope || ':' || p_key_hash, 0));
  insert into public.api_rate_limit_buckets (
    scope, key_hash, window_started_at, request_count
  ) values (
    trim(p_scope), p_key_hash, now(), 1
  )
  on conflict (scope, key_hash) do update
  set window_started_at = case
        when public.api_rate_limit_buckets.window_started_at <=
             now() - make_interval(secs => p_window_seconds)
          then now()
        else public.api_rate_limit_buckets.window_started_at
      end,
      request_count = case
        when public.api_rate_limit_buckets.window_started_at <=
             now() - make_interval(secs => p_window_seconds)
          then 1
        else public.api_rate_limit_buckets.request_count + 1
      end,
      updated_at = now()
  returning request_count <= p_limit into v_allowed;

  return v_allowed;
end
$$;

-- Signup provisioning is atomic with auth.users creation. A failed household or
-- membership insert rolls back the signup trigger rather than leaving a partial
-- authorization graph.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_display_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, v_display_name, 'parent')
  on conflict (id) do nothing;

  insert into public.households (
    name, created_by_user_id, legacy_owner_user_id
  ) values (
    left(coalesce(v_display_name || '''s household', 'Household'), 120), new.id, new.id
  )
  on conflict (legacy_owner_user_id) do nothing;

  select id into strict v_household_id
  from public.households where legacy_owner_user_id = new.id;

  update public.profiles
  set primary_household_id = v_household_id
  where id = new.id and primary_household_id is null;

  insert into public.household_memberships (
    household_id, user_id, role, status, can_manage_learners, can_book,
    can_manage_billing, can_view_all_bookings
  ) values (
    v_household_id, new.id, 'owner', 'active', true, true, true, true
  )
  on conflict (household_id, user_id) do nothing;

  insert into public.account_roles (user_id, role, reason)
  values (new.id, 'parent', 'Automatic signup grant')
  on conflict (user_id, role) where revoked_at is null do nothing;

  return new;
end
$$;

-- RLS remains a second line of defence for trusted/user-scoped clients. Provider,
-- payment, booking-contact, and ledger tables are deliberately service-only.
alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.learners enable row level security;
alter table public.account_roles enable row level security;
alter table public.offer_versions enable row level security;
alter table public.active_offers enable row level security;
alter table public.payment_orders enable row level security;
alter table public.stripe_events enable row level security;
alter table public.api_rate_limit_buckets enable row level security;
alter table public.provider_events enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.booking_operations enable row level security;
alter table public.booking_slot_claims enable row level security;
alter table public.booking_audit_log enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_disputes enable row level security;

create policy households_member_read on public.households
for select to authenticated
using (public.has_household_permission(id, 'view'));
create policy household_memberships_household_read on public.household_memberships
for select to authenticated
using (public.has_household_permission(household_id, 'view'));
create policy learners_guardian_read on public.learners
for select to authenticated
using (public.has_household_permission(household_id, 'view'));
create policy account_roles_own_read on public.account_roles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists profiles_own_read on public.profiles;
drop policy if exists profiles_own_display_name_update on public.profiles;
drop policy if exists package_purchases_owner_read on public.package_purchases;
drop policy if exists bookings_authorized_read on public.bookings;

create policy profiles_service_boundary on public.profiles
for select to authenticated using (false);
create policy package_purchases_household_read on public.package_purchases
for select to authenticated
using (public.has_household_permission(household_id, 'manage_billing'));
create policy bookings_household_or_staff_read on public.bookings
for select to authenticated
using (
  public.has_household_permission(household_id, 'view_all_bookings')
  or public.is_admin()
  or public.is_assigned_tutor(tutor_id)
);

revoke all on public.households, public.household_memberships, public.learners,
  public.account_roles, public.offer_versions, public.active_offers,
  public.payment_orders, public.stripe_events, public.provider_events,
  public.api_rate_limit_buckets,
  public.credit_accounts, public.credit_grants, public.credit_ledger,
  public.booking_operations, public.booking_slot_claims, public.booking_audit_log, public.payment_refunds,
  public.payment_disputes
from anon, authenticated;
-- Household, role, and learner data is exposed only through minimized server
-- DTOs. This prevents an AAL1 staff session from bypassing the server MFA gate.
revoke all on public.households, public.household_memberships,
  public.account_roles, public.learners from anon, authenticated;

-- Retire the legacy direct tutor availability mutation path. Availability is
-- managed by the scheduling provider and staff server APIs, both MFA gated.
drop policy if exists tutors_assigned_update on public.tutors;
revoke update on public.tutors from anon, authenticated;

-- Sensitive legacy base-table reads are server API concerns. service_role retains
-- owner-level access and RLS bypass; browser roles cannot enumerate contact or
-- financial records directly.
revoke all on public.profiles, public.package_purchases, public.bookings
from anon, authenticated;

revoke all on function public.reject_immutable_mutation() from public, anon, authenticated;
revoke all on function public.protect_payment_order_commercial_facts() from public, anon, authenticated;
revoke all on function public.protect_stripe_event_payload() from public, anon, authenticated;
revoke all on function public.protect_provider_event_payload() from public, anon, authenticated;
revoke all on function public.protect_booking_operation_request() from public, anon, authenticated;
revoke all on function public.protect_booking_slot_claim() from public, anon, authenticated;
revoke all on function public.validate_booking_slot_claim() from public, anon, authenticated;
revoke all on function public.sync_booking_slot_claim() from public, anon, authenticated;
revoke all on function public.apply_credit_ledger_balance() from public, anon, authenticated;
revoke all on function public.assert_credit_account_projection() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_active_account_role(uuid, public.user_role, uuid)
  from public, anon, authenticated;
revoke all on function public.has_household_permission_for_user(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.has_household_permission(uuid, text) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_assigned_tutor(uuid) from public, anon;
revoke all on function public.enforce_household_learner_limit()
  from public, anon, authenticated;
grant execute on function public.has_household_permission(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_assigned_tutor(uuid) to authenticated;

create or replace function public.create_payment_order(
  p_user_id uuid,
  p_household_id uuid,
  p_package_slug text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_offer public.offer_versions%rowtype;
  v_inserted boolean := false;
begin
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(p_idempotency_key) > 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:' || p_user_id::text || ':' || p_idempotency_key, 0));

  if not public.has_household_permission_for_user(p_user_id, p_household_id, 'manage_billing') then
    raise exception 'HOUSEHOLD_BILLING_FORBIDDEN';
  end if;

  select * into v_order
  from public.payment_orders
  where user_id = p_user_id and client_idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_order.household_id <> p_household_id or not exists (
      select 1 from public.offer_versions ov
      join public.packages p on p.id = ov.package_id
      where ov.id = v_order.offer_version_id and p.slug = p_package_slug
    ) then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if v_order.currency <> 'EUR' or not exists (
      select 1
      from public.offer_versions ov
      where ov.id = v_order.offer_version_id
        and ov.provider = 'stripe'
        and ov.currency = 'EUR'
        and ov.currency = v_order.currency
    ) then
      raise exception 'OFFER_NOT_AVAILABLE';
    end if;
    -- A retained idempotency key must not create a fresh provider session for
    -- an offer that was disabled, replaced, expired, or commercially changed.
    -- An already-attached provider session is grandfathered because its URL may
    -- already have been handed to the customer.
    if v_order.stripe_checkout_session_id is null
       and v_order.status in ('pending', 'checkout_created')
       and not exists (
         select 1
         from public.offer_versions ov
         join public.packages p on p.id = ov.package_id
         join public.active_offers ao
           on ao.package_id = p.id and ao.offer_version_id = ov.id
         where ov.id = v_order.offer_version_id
           and p.slug = p_package_slug
           and p.active
           and ao.checkout_enabled
           and ov.provider = 'stripe'
           and ov.tax_behavior = 'inclusive'
           and ov.amount_cents = v_order.amount_cents
           and ov.currency = 'EUR'
           and ov.currency = v_order.currency
           and ov.stripe_livemode = v_order.livemode
           and ov.effective_from <= now()
           and (ov.effective_until is null or ov.effective_until > now())
       ) then
      raise exception 'OFFER_NOT_AVAILABLE';
    end if;
    return jsonb_build_object(
      'order_id', v_order.id,
      'offer_version_id', v_order.offer_version_id,
      'stripe_price_id', (select stripe_price_id from public.offer_versions where id = v_order.offer_version_id),
      'amount_cents', v_order.amount_cents,
      'currency', v_order.currency,
      'status', v_order.status,
      'replayed', true
    );
  end if;

  select ov.* into v_offer
  from public.packages p
  join public.active_offers ao on ao.package_id = p.id
  join public.offer_versions ov on ov.id = ao.offer_version_id
  where p.slug = p_package_slug
    and p.active
    and ao.checkout_enabled
    and ov.provider = 'stripe'
    and ov.tax_behavior = 'inclusive'
    and ov.amount_cents > 0
    and ov.currency = 'EUR'
    and ov.effective_from <= now()
    and (ov.effective_until is null or ov.effective_until > now());
  if not found then raise exception 'OFFER_NOT_AVAILABLE'; end if;

  insert into public.payment_orders (
    household_id, user_id, offer_version_id, provider, status, currency,
    amount_cents, quantity, client_idempotency_key, livemode
  ) values (
    p_household_id, p_user_id, v_offer.id, 'stripe', 'pending', v_offer.currency,
    v_offer.amount_cents, 1, p_idempotency_key, v_offer.stripe_livemode
  )
  returning * into v_order;
  v_inserted := true;

  return jsonb_build_object(
    'order_id', v_order.id,
    'offer_version_id', v_order.offer_version_id,
    'stripe_price_id', v_offer.stripe_price_id,
    'amount_cents', v_order.amount_cents,
    'currency', v_order.currency,
    'status', v_order.status,
    'replayed', not v_inserted
  );
end
$$;

create or replace function public.attach_stripe_checkout_session(
  p_order_id uuid,
  p_user_id uuid,
  p_checkout_session_id text,
  p_stripe_customer_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_replayed boolean;
begin
  if nullif(trim(p_checkout_session_id), '') is null then
    raise exception 'INVALID_CHECKOUT_SESSION';
  end if;
  select * into v_order from public.payment_orders
  where id = p_order_id and user_id = p_user_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.provider <> 'stripe' then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;
  if v_order.currency <> 'EUR' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if v_order.stripe_checkout_session_id is not null
     and v_order.stripe_checkout_session_id <> p_checkout_session_id then
    raise exception 'CHECKOUT_SESSION_ALREADY_ATTACHED';
  end if;
  if v_order.status not in ('pending', 'checkout_created') then
    raise exception 'PAYMENT_ORDER_NOT_ATTACHABLE';
  end if;

  -- Recheck inside the same transaction that attaches the newly-created
  -- Checkout Session. If an operator flips the offer pointer or kill switch
  -- after the API preflight, attachment fails and the API expires the orphan.
  if v_order.stripe_checkout_session_id is null and not exists (
    select 1
    from public.offer_versions ov
    join public.packages p on p.id = ov.package_id
    join public.active_offers ao
      on ao.package_id = p.id and ao.offer_version_id = ov.id
    where ov.id = v_order.offer_version_id
      and p.active
      and ao.checkout_enabled
      and ov.provider = 'stripe'
      and ov.tax_behavior = 'inclusive'
      and ov.amount_cents = v_order.amount_cents
      and ov.currency = 'EUR'
      and ov.currency = v_order.currency
      and ov.stripe_livemode = v_order.livemode
      and ov.effective_from <= now()
      and (ov.effective_until is null or ov.effective_until > now())
  ) then
    raise exception 'OFFER_NOT_AVAILABLE';
  end if;

  v_replayed := v_order.stripe_checkout_session_id = p_checkout_session_id;
  update public.payment_orders
  set stripe_checkout_session_id = p_checkout_session_id,
      stripe_customer_id = coalesce(stripe_customer_id, nullif(trim(p_stripe_customer_id), '')),
      status = 'checkout_created'
  where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'checkout_session_id', v_order.stripe_checkout_session_id,
    'replayed', v_replayed
  );
end
$$;

create or replace function public.ingest_stripe_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_api_version text,
  p_object_created_at timestamptz,
  p_payload jsonb,
  p_payload_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.stripe_events%rowtype;
  v_rows integer;
begin
  if nullif(trim(p_event_id), '') is null
     or nullif(trim(p_event_type), '') is null
     or p_payload is null
     or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_STRIPE_EVENT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || p_event_id, 0));

  insert into public.stripe_events (
    event_id, event_type, livemode, api_version, object_created_at, payload,
    payload_sha256, status, processed_at
  ) values (
    p_event_id, p_event_type, p_livemode, p_api_version, p_object_created_at,
    p_payload, p_payload_sha256,
    case when p_event_type in (
      'checkout.session.completed', 'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed', 'checkout.session.expired',
      'refund.created', 'refund.updated', 'refund.failed',
      'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'
    ) then 'received'::public.inbox_event_status else 'ignored'::public.inbox_event_status end,
    case when p_event_type in (
      'checkout.session.completed', 'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed', 'checkout.session.expired',
      'refund.created', 'refund.updated', 'refund.failed',
      'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'
    ) then null else now() end
  )
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into strict v_existing from public.stripe_events where event_id = p_event_id;
    if v_existing.event_type <> p_event_type
       or v_existing.livemode <> p_livemode
       or v_existing.payload_sha256 <> p_payload_sha256 then
      raise exception 'STRIPE_EVENT_ID_COLLISION';
    end if;
    return false;
  end if;
  return true;
end
$$;

create or replace function public.fulfill_stripe_checkout(
  p_event_id text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_subtotal integer,
  p_amount_total integer,
  p_tax_amount integer,
  p_currency text,
  p_payment_status text,
  p_stripe_price_id text,
  p_price_unit_amount integer,
  p_quantity integer,
  p_stripe_customer_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_events%rowtype;
  v_order public.payment_orders%rowtype;
  v_offer public.offer_versions%rowtype;
  v_purchase_id uuid;
  v_account_id uuid;
  v_grant_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || p_event_id, 0));
  select * into v_event from public.stripe_events where event_id = p_event_id for update;
  if not found then raise exception 'STRIPE_EVENT_NOT_INGESTED'; end if;

  select * into v_order from public.payment_orders
  where stripe_checkout_session_id = p_checkout_session_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_event.event_type not in (
    'checkout.session.completed', 'checkout.session.async_payment_succeeded'
  ) then raise exception 'UNEXPECTED_STRIPE_EVENT_TYPE'; end if;
  if v_event.effect_type is not null and (
    v_event.effect_type <> 'checkout_fulfillment'
    or v_event.effect_reference <> p_checkout_session_id
    or v_event.payment_order_id <> v_order.id
  ) then raise exception 'STRIPE_EVENT_EFFECT_COLLISION'; end if;
  update public.stripe_events
  set effect_type = 'checkout_fulfillment',
      effect_reference = p_checkout_session_id,
      payment_order_id = v_order.id
  where event_id = p_event_id
  returning * into v_event;

  select * into strict v_offer from public.offer_versions where id = v_order.offer_version_id;
  if v_order.provider <> 'stripe'
     or v_offer.provider <> 'stripe'
     or v_event.livemode <> v_order.livemode
     or p_payment_status <> 'paid'
     or p_quantity <> 1
     or p_amount_subtotal <> v_order.amount_cents
     or p_price_unit_amount <> v_order.amount_cents
     or p_tax_amount < 0
     or (v_offer.tax_behavior = 'inclusive' and p_amount_total <> v_order.amount_cents)
     or (v_offer.tax_behavior = 'exclusive'
         and p_amount_total <> v_order.amount_cents + p_tax_amount)
     or upper(p_currency) <> v_order.currency
     or p_stripe_price_id <> v_offer.stripe_price_id
     or nullif(trim(p_payment_intent_id), '') is null then
    raise exception 'STRIPE_FULFILLMENT_MISMATCH';
  end if;

  if v_order.fulfilled_at is not null then
    if v_order.stripe_payment_intent_id <> p_payment_intent_id then
      raise exception 'PAYMENT_INTENT_MISMATCH';
    end if;
    update public.stripe_events
    set status = 'processed', processed_at = coalesce(processed_at, now()),
        attempt_count = attempt_count + 1, last_error = null
    where event_id = p_event_id;
    return jsonb_build_object(
      'order_id', v_order.id,
      'package_purchase_id', v_order.package_purchase_id,
      'credit_grant_id', (select credit_grant_id from public.package_purchases where id = v_order.package_purchase_id),
      'status', 'paid',
      'current_order_status', v_order.status,
      'replayed', true
    );
  end if;

  update public.stripe_events
  set status = 'processing', attempt_count = attempt_count + 1, last_error = null
  where event_id = p_event_id;

  insert into public.package_purchases (
    user_id, package_id, total_sessions, used_sessions, remaining_sessions,
    status, payment_status, payment_reference, price_paid_cents, household_id,
    offer_version_id, payment_order_id, created_at, updated_at
  ) values (
    v_order.user_id, v_offer.package_id, v_offer.sessions, 0, v_offer.sessions,
    'active', 'verified', p_payment_intent_id, p_amount_total,
    v_order.household_id, v_offer.id, v_order.id, now(), now()
  )
  returning id into v_purchase_id;

  update public.payment_orders
  set package_purchase_id = v_purchase_id,
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_customer_id = coalesce(nullif(trim(p_stripe_customer_id), ''), stripe_customer_id),
      paid_total_cents = p_amount_total,
      tax_cents = p_tax_amount,
      status = 'paid', paid_at = coalesce(paid_at, now()), fulfilled_at = now(),
      failure_code = null, failure_detail = null
  where id = v_order.id;

  insert into public.credit_accounts (household_id)
  values (v_order.household_id)
  on conflict (household_id, unit) do update set updated_at = public.credit_accounts.updated_at
  returning id into v_account_id;

  insert into public.credit_grants (
    credit_account_id, payment_order_id, package_purchase_id, offer_version_id,
    granted_quantity, valid_from
  ) values (
    v_account_id, v_order.id, v_purchase_id, v_offer.id, v_offer.sessions, now()
  ) returning id into v_grant_id;

  update public.package_purchases set credit_grant_id = v_grant_id
  where id = v_purchase_id;

  insert into public.credit_ledger (
    credit_account_id, credit_grant_id, entry_kind, delta, idempotency_key,
    source_type, source_id, source_action, stripe_event_id, note
  ) values (
    v_account_id, v_grant_id, 'grant', v_offer.sessions,
    'stripe:order:' || v_order.id::text || ':grant',
    'payment_order', v_order.id::text, 'fulfill', p_event_id,
    'Credits granted by verified Stripe Checkout fulfillment'
  );

  update public.stripe_events
  set status = 'processed', processed_at = now(), last_error = null
  where event_id = p_event_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'package_purchase_id', v_purchase_id,
    'credit_grant_id', v_grant_id,
    'status', 'paid',
    'replayed', false
  );
end
$$;

create or replace function public.fail_stripe_payment_order(
  p_event_id text,
  p_checkout_session_id text,
  p_status public.payment_order_status,
  p_failure_code text default null,
  p_failure_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_events%rowtype;
  v_order public.payment_orders%rowtype;
begin
  if p_status not in ('failed', 'expired') then
    raise exception 'INVALID_FAILURE_STATUS';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || p_event_id, 0));
  select * into v_event from public.stripe_events where event_id = p_event_id for update;
  if not found then raise exception 'STRIPE_EVENT_NOT_INGESTED'; end if;
  select * into v_order from public.payment_orders
  where stripe_checkout_session_id = p_checkout_session_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_event.event_type not in (
    'checkout.session.async_payment_failed', 'checkout.session.expired'
  ) then raise exception 'UNEXPECTED_STRIPE_EVENT_TYPE'; end if;
  if v_event.effect_type is not null and (
    v_event.effect_type <> 'checkout_failure'
    or v_event.effect_reference <> p_checkout_session_id
    or v_event.payment_order_id <> v_order.id
  ) then raise exception 'STRIPE_EVENT_EFFECT_COLLISION'; end if;
  update public.stripe_events
  set effect_type = 'checkout_failure',
      effect_reference = p_checkout_session_id,
      payment_order_id = v_order.id
  where event_id = p_event_id
  returning * into v_event;

  if v_event.status = 'processed' then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'replayed', true);
  end if;
  if v_order.status in ('paid', 'refunded', 'disputed') then
    update public.stripe_events
    set status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1,
        last_error = 'Terminal paid order was not downgraded'
    where event_id = p_event_id;
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'replayed', false);
  end if;

  update public.payment_orders
  set status = p_status,
      failed_at = case when p_status = 'failed' then now() else failed_at end,
      expired_at = case when p_status = 'expired' then now() else expired_at end,
      failure_code = nullif(trim(p_failure_code), ''),
      failure_detail = left(nullif(trim(p_failure_detail), ''), 2000)
  where id = v_order.id;
  update public.stripe_events
  set status = 'processed', processed_at = now(), attempt_count = attempt_count + 1,
      last_error = null
  where event_id = p_event_id;
  return jsonb_build_object('order_id', v_order.id, 'status', p_status, 'replayed', false);
end
$$;

create or replace function public.apply_stripe_refund(
  p_event_id text,
  p_stripe_refund_id text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_refund_status text,
  p_reason text default null,
  p_provider_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_events%rowtype;
  v_order public.payment_orders%rowtype;
  v_refund public.payment_refunds%rowtype;
  v_grant public.credit_grants%rowtype;
  v_successful_total integer;
  v_grant_balance integer;
  v_event_time timestamptz;
begin
  if p_amount_cents <= 0 or nullif(trim(p_stripe_refund_id), '') is null then
    raise exception 'INVALID_REFUND';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || p_event_id, 0));
  select * into v_event from public.stripe_events where event_id = p_event_id for update;
  if not found then raise exception 'STRIPE_EVENT_NOT_INGESTED'; end if;
  select * into v_order from public.payment_orders
  where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  perform 1 from public.package_purchases
  where payment_order_id = v_order.id for update;
  if upper(p_currency) <> v_order.currency
     or p_amount_cents > coalesce(v_order.paid_total_cents, v_order.amount_cents) then
    raise exception 'REFUND_AMOUNT_MISMATCH';
  end if;
  if v_event.livemode <> v_order.livemode then raise exception 'STRIPE_MODE_MISMATCH'; end if;

  select * into v_refund from public.payment_refunds
  where stripe_refund_id = p_stripe_refund_id for update;
  if found and (
    v_refund.payment_order_id <> v_order.id
    or v_refund.amount_cents <> p_amount_cents
    or v_refund.currency <> upper(p_currency)
  ) then
    raise exception 'STRIPE_REFUND_ID_COLLISION';
  end if;
  if v_event.event_type not in ('refund.created', 'refund.updated', 'refund.failed') then
    raise exception 'UNEXPECTED_STRIPE_EVENT_TYPE';
  end if;
  if v_event.effect_type is not null and (
    v_event.effect_type <> 'refund'
    or v_event.effect_reference <> p_stripe_refund_id
    or v_event.payment_order_id <> v_order.id
  ) then raise exception 'STRIPE_EVENT_EFFECT_COLLISION'; end if;
  update public.stripe_events
  set effect_type = 'refund', effect_reference = p_stripe_refund_id,
      payment_order_id = v_order.id
  where event_id = p_event_id
  returning * into v_event;
  v_event_time := coalesce(v_event.object_created_at, v_event.received_at);
  if v_event.status = 'processed' and v_refund.id is not null then
    return jsonb_build_object(
      'order_id', v_order.id, 'refund_id', v_refund.id,
      'status', v_order.status, 'replayed', true
    );
  end if;

  if v_refund.id is not null and (
    v_refund.last_event_created_at > v_event_time
    or (
      v_refund.last_event_created_at = v_event_time
      and lower(v_refund.status) in ('succeeded', 'failed', 'canceled')
      and lower(v_refund.status) <> lower(p_refund_status)
    )
  ) then
    update public.stripe_events
    set status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1,
        last_error = 'STALE_REFUND_EVENT'
    where event_id = p_event_id;
    return jsonb_build_object(
      'order_id', v_order.id, 'refund_id', v_refund.id,
      'status', v_order.status, 'stale', true, 'replayed', false
    );
  end if;

  insert into public.payment_refunds (
    payment_order_id, stripe_event_id, stripe_refund_id, amount_cents, currency,
    status, reason, provider_created_at, last_event_created_at
  ) values (
    v_order.id, p_event_id, p_stripe_refund_id, p_amount_cents,
    upper(p_currency), p_refund_status, nullif(trim(p_reason), ''), p_provider_created_at,
    v_event_time
  )
  on conflict (stripe_refund_id) do update
  set stripe_event_id = excluded.stripe_event_id,
      status = excluded.status,
      reason = coalesce(excluded.reason, public.payment_refunds.reason),
      provider_created_at = coalesce(excluded.provider_created_at, public.payment_refunds.provider_created_at),
      last_event_created_at = excluded.last_event_created_at
  returning * into v_refund;

  select coalesce(sum(amount_cents), 0)::integer into v_successful_total
  from public.payment_refunds
  where payment_order_id = v_order.id and lower(status) = 'succeeded';
  if v_successful_total > coalesce(v_order.paid_total_cents, v_order.amount_cents) then
    raise exception 'REFUND_TOTAL_EXCEEDS_ORDER';
  end if;

  if v_successful_total = coalesce(v_order.paid_total_cents, v_order.amount_cents) then
    select * into v_grant from public.credit_grants where payment_order_id = v_order.id;
    if found then
      select coalesce(sum(delta), 0)::integer into v_grant_balance
      from public.credit_ledger where credit_grant_id = v_grant.id;
      if v_grant_balance > 0 then
        insert into public.credit_ledger (
          credit_account_id, credit_grant_id, entry_kind, delta, idempotency_key,
          source_type, source_id, source_action, stripe_event_id, note
        ) values (
          v_grant.credit_account_id, v_grant.id, 'revocation', -v_grant_balance,
          'stripe:order:' || v_order.id::text || ':refund-revoke',
          'payment_order', v_order.id::text, 'refund_revocation', p_event_id,
          'Revokes only unspent credit after a full successful refund'
        ) on conflict (idempotency_key) do nothing;
      end if;
    end if;
    update public.payment_orders
    set status = 'refunded', refunded_at = coalesce(refunded_at, now())
    where id = v_order.id;
    update public.package_purchases
    set payment_status = 'refunded', status = 'cancelled'
    where payment_order_id = v_order.id;
  end if;

  update public.stripe_events
  set status = 'processed', processed_at = now(), attempt_count = attempt_count + 1,
      last_error = null
  where event_id = p_event_id;
  return jsonb_build_object(
    'order_id', v_order.id,
    'refund_id', v_refund.id,
    'refunded_amount_cents', v_successful_total,
    'status', case
      when v_successful_total = coalesce(v_order.paid_total_cents, v_order.amount_cents)
        then 'refunded'
      else v_order.status::text
    end,
    'replayed', false
  );
end
$$;

create or replace function public.apply_stripe_dispute(
  p_event_id text,
  p_stripe_dispute_id text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_dispute_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_events%rowtype;
  v_order public.payment_orders%rowtype;
  v_dispute public.payment_disputes%rowtype;
  v_grant public.credit_grants%rowtype;
  v_grant_balance integer;
  v_event_time timestamptz;
  v_is_adverse boolean;
  v_is_resolved boolean;
  v_has_adverse boolean;
  v_inserted integer;
  v_deferred_booking public.bookings%rowtype;
begin
  if p_amount_cents <= 0 or nullif(trim(p_stripe_dispute_id), '') is null then
    raise exception 'INVALID_DISPUTE';
  end if;
  v_is_adverse := lower(p_dispute_status) in (
    'warning_needs_response', 'warning_under_review',
    'needs_response', 'under_review', 'lost'
  );
  v_is_resolved := lower(p_dispute_status) in ('won', 'warning_closed', 'prevented');
  if not v_is_adverse and not v_is_resolved then
    raise exception 'INVALID_DISPUTE_STATUS';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || p_event_id, 0));
  select * into v_event from public.stripe_events where event_id = p_event_id for update;
  if not found then raise exception 'STRIPE_EVENT_NOT_INGESTED'; end if;
  select * into v_order from public.payment_orders
  where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  perform 1 from public.package_purchases
  where payment_order_id = v_order.id for update;
  if upper(p_currency) <> v_order.currency
     or p_amount_cents > coalesce(v_order.paid_total_cents, v_order.amount_cents)
     or v_event.livemode <> v_order.livemode then
    raise exception 'DISPUTE_ORDER_MISMATCH';
  end if;
  if v_event.event_type not in (
    'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'
  ) then raise exception 'UNEXPECTED_STRIPE_EVENT_TYPE'; end if;

  select * into v_dispute from public.payment_disputes
  where stripe_dispute_id = p_stripe_dispute_id for update;
  if found and (
    v_dispute.payment_order_id <> v_order.id
    or v_dispute.amount_cents <> p_amount_cents
    or v_dispute.currency <> upper(p_currency)
  ) then
    raise exception 'STRIPE_DISPUTE_ID_COLLISION';
  end if;
  if v_event.effect_type is not null and (
    v_event.effect_type <> 'dispute'
    or v_event.effect_reference <> p_stripe_dispute_id
    or v_event.payment_order_id <> v_order.id
  ) then raise exception 'STRIPE_EVENT_EFFECT_COLLISION'; end if;
  update public.stripe_events
  set effect_type = 'dispute', effect_reference = p_stripe_dispute_id,
      payment_order_id = v_order.id
  where event_id = p_event_id
  returning * into v_event;
  v_event_time := coalesce(v_event.object_created_at, v_event.received_at);

  if v_event.status = 'processed' and v_dispute.id is not null then
    return jsonb_build_object(
      'order_id', v_order.id, 'dispute_id', v_dispute.id,
      'status', v_order.status, 'replayed', true
    );
  end if;

  if v_dispute.id is not null and (
    v_dispute.last_event_created_at > v_event_time
    or (
      v_dispute.last_event_created_at = v_event_time
      and lower(v_dispute.status) in ('won', 'lost', 'warning_closed', 'prevented')
      and lower(v_dispute.status) <> lower(p_dispute_status)
    )
  ) then
    update public.stripe_events
    set status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1,
        last_error = 'STALE_DISPUTE_EVENT'
    where event_id = p_event_id;
    return jsonb_build_object(
      'order_id', v_order.id, 'dispute_id', v_dispute.id,
      'status', v_order.status, 'stale', true, 'replayed', false
    );
  end if;

  insert into public.payment_disputes (
    payment_order_id, stripe_event_id, stripe_dispute_id, amount_cents, currency,
    status, last_event_created_at
  ) values (
    v_order.id, p_event_id, p_stripe_dispute_id, p_amount_cents,
    upper(p_currency), p_dispute_status, v_event_time
  )
  on conflict (stripe_dispute_id) do update
  set stripe_event_id = excluded.stripe_event_id, status = excluded.status,
      last_event_created_at = excluded.last_event_created_at
  returning * into v_dispute;

  select * into v_grant from public.credit_grants where payment_order_id = v_order.id;
  select exists (
    select 1 from public.payment_disputes pd
    where pd.payment_order_id = v_order.id
      and lower(pd.status) in (
        'warning_needs_response', 'warning_under_review',
        'needs_response', 'under_review', 'lost'
      )
  ) into v_has_adverse;

  -- A completed refund remains authoritative over every later dispute update.
  if v_order.status <> 'refunded' and v_has_adverse then
    if v_grant.id is not null then
      select coalesce(sum(delta), 0)::integer into v_grant_balance
      from public.credit_ledger where credit_grant_id = v_grant.id;
      if v_grant_balance > 0 then
        insert into public.credit_ledger (
          credit_account_id, credit_grant_id, entry_kind, delta, idempotency_key,
          source_type, source_id, source_action, stripe_event_id, note
        ) values (
          v_grant.credit_account_id, v_grant.id, 'revocation', -v_grant_balance,
          'stripe:dispute:' || p_stripe_dispute_id || ':revoke',
          'stripe_dispute', p_stripe_dispute_id, 'revoke', p_event_id,
          'Temporarily revokes unspent credit while payment is disputed'
        ) on conflict (idempotency_key) do nothing;
      end if;
    end if;
    update public.payment_orders set status = 'disputed' where id = v_order.id;
    update public.package_purchases set status = 'cancelled'
    where payment_order_id = v_order.id and payment_status = 'verified';
  elsif v_order.status <> 'refunded' and not v_has_adverse then
    if v_grant.id is not null then
      -- Restore every still-unreversed revocation only after all disputes for
      -- this payment are resolved in the merchant's favour.
      insert into public.credit_ledger (
        credit_account_id, credit_grant_id, entry_kind, delta, idempotency_key,
        source_type, source_id, source_action, reverses_entry_id,
        stripe_event_id, note
      )
      select cl.credit_account_id, cl.credit_grant_id, 'adjustment', -cl.delta,
             'stripe:dispute-ledger:' || cl.id::text || ':restore',
             'stripe_dispute_resolution', cl.id::text, 'restore', cl.id,
             p_event_id, 'Restores credit after all disputes are resolved'
      from public.credit_ledger cl
      where cl.credit_grant_id = v_grant.id
        and cl.source_type = 'stripe_dispute'
        and cl.source_action = 'revoke'
        and not exists (
          select 1 from public.credit_ledger reversal
          where reversal.reverses_entry_id = cl.id
        )
      on conflict (idempotency_key) do nothing;

      -- A cancellation or failed create that happened while credit was frozen
      -- could not restore its reservation then. Settle that deferred credit now.
      for v_deferred_booking in
        select b.* from public.bookings b
        where b.credit_grant_id = v_grant.id
          and b.lifecycle_status in ('cancelled', 'failed')
          and b.credit_status = 'released'
          and b.credit_reservation_entry_id is not null
          and not exists (
            select 1 from public.credit_ledger cl
            where cl.booking_id = b.id
              and cl.entry_kind in ('release', 'cancellation_restore')
          )
        for update
      loop
        insert into public.credit_ledger (
          credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
          idempotency_key, source_type, source_id, source_action,
          reverses_entry_id, stripe_event_id, note
        ) values (
          v_grant.credit_account_id, v_grant.id, v_deferred_booking.id,
          case when v_deferred_booking.lifecycle_status = 'cancelled'
               then 'cancellation_restore'::public.credit_entry_kind
               else 'release'::public.credit_entry_kind end,
          1,
          'booking:' || v_deferred_booking.id::text ||
            case when v_deferred_booking.lifecycle_status = 'cancelled'
                 then ':cancel-restore' else ':release' end,
          'booking', v_deferred_booking.id::text,
          case when v_deferred_booking.lifecycle_status = 'cancelled'
               then 'cancel_restore' else 'release' end,
          v_deferred_booking.credit_reservation_entry_id, p_event_id,
          'Deferred booking credit restored after dispute resolution'
        ) on conflict (idempotency_key) do nothing;
        get diagnostics v_inserted = row_count;

        if v_inserted > 0 then
          if exists (
            select 1 from public.credit_ledger cl
            where cl.booking_id = v_deferred_booking.id and cl.entry_kind = 'consumption'
          ) then
            update public.package_purchases
            set used_sessions = used_sessions - 1,
                remaining_sessions = remaining_sessions + 1,
                completed_at = null
            where id = v_deferred_booking.package_purchase_id and used_sessions > 0;
            if not found then raise exception 'CREDIT_PROJECTION_RESTORE_FAILED'; end if;
          end if;
          update public.bookings set credit_status = 'restored'
          where id = v_deferred_booking.id;
          insert into public.booking_audit_log (
            booking_id, action, actor_kind, after_state
          ) values (
            v_deferred_booking.id, 'deferred_credit_restored_after_dispute', 'system',
            jsonb_build_object('stripe_event_id', p_event_id, 'credit_status', 'restored')
          );
        end if;
      end loop;
    end if;
    update public.payment_orders set status = 'paid' where id = v_order.id;
    update public.package_purchases
    set status = case when remaining_sessions > 0 then 'active'::public.purchase_status
                      else 'completed'::public.purchase_status end
    where payment_order_id = v_order.id and payment_status = 'verified';
  end if;

  update public.stripe_events
  set status = 'processed',
      processed_at = now(), attempt_count = attempt_count + 1, last_error = null
  where event_id = p_event_id;
  select * into strict v_order from public.payment_orders where id = v_order.id;
  return jsonb_build_object(
    'order_id', v_order.id, 'dispute_id', v_dispute.id,
    'status', v_order.status,
    'replayed', false
  );
end
$$;

create or replace function public.reserve_booking_credit(
  p_user_id uuid,
  p_household_id uuid,
  p_learner_id uuid,
  p_tutor_id uuid,
  p_package_id uuid,
  p_package_purchase_id uuid,
  p_subject_id text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_time_zone text,
  p_location text,
  p_location_venue text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_message text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_operation public.booking_operations%rowtype;
  v_purchase public.package_purchases%rowtype;
  v_grant public.credit_grants%rowtype;
  v_account public.credit_accounts%rowtype;
  v_reservation_id uuid;
  v_package_slug text;
  v_grant_balance integer;
  v_request_facts jsonb;
begin
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(p_idempotency_key) > 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('booking:' || p_idempotency_key, 0));
  if not public.has_household_permission_for_user(p_user_id, p_household_id, 'book') then
    raise exception 'HOUSEHOLD_BOOKING_FORBIDDEN';
  end if;
  v_request_facts := jsonb_build_object(
    'user_id', p_user_id,
    'household_id', p_household_id,
    'learner_id', p_learner_id,
    'tutor_id', p_tutor_id,
    'package_id', p_package_id,
    'requested_package_purchase_id', p_package_purchase_id,
    'subject_id', p_subject_id,
    'starts_at', p_starts_at,
    'duration_minutes', p_duration_minutes,
    'time_zone', trim(p_time_zone),
    'location', p_location,
    'location_venue', nullif(trim(p_location_venue), ''),
    'contact_name', trim(p_contact_name),
    'contact_email', lower(trim(p_contact_email)),
    'contact_phone', nullif(trim(p_contact_phone), ''),
    'message', nullif(trim(p_message), '')
  );
  select * into v_booking from public.bookings
  where idempotency_key = p_idempotency_key for update;
  if found then
    select * into v_operation from public.booking_operations
    where booking_id = v_booking.id and operation_type = 'create'
    order by created_at limit 1
    for update;
    if not found or v_operation.request_facts <> v_request_facts then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'booking_id', v_booking.id,
      'operation_id', v_operation.id,
      'operation_status', v_operation.status,
      'lifecycle_status', v_booking.lifecycle_status,
      'credit_status', v_booking.credit_status,
      'starts_at', v_booking.starts_at,
      'current_lifecycle_status', v_booking.lifecycle_status,
      'current_credit_status', v_booking.credit_status,
      'replayed', true
    );
  end if;

  if not exists (
    select 1 from public.learners
    where id = p_learner_id and household_id = p_household_id and is_active
  ) then raise exception 'INVALID_LEARNER'; end if;
  if p_starts_at <= now() then raise exception 'INVALID_START_TIME'; end if;
  if p_duration_minutes not between 15 and 240 then raise exception 'INVALID_DURATION'; end if;
  if nullif(trim(p_time_zone), '') is null then raise exception 'INVALID_TIME_ZONE'; end if;
  if p_location not in ('online', 'in-person') then raise exception 'INVALID_LOCATION'; end if;
  if p_location = 'in-person' and nullif(trim(p_location_venue), '') is null then
    raise exception 'VENUE_REQUIRED';
  end if;
  if not exists (
    select 1 from public.tutors
    where id = p_tutor_id and active and p_subject_id = any(subject_ids)
      and (not online_only or p_location = 'online')
  ) then raise exception 'INVALID_TUTOR_SUBJECT_OR_LOCATION'; end if;

  select slug into v_package_slug from public.packages
  where id = p_package_id and active;
  if v_package_slug is null then raise exception 'INVALID_PACKAGE'; end if;

  if v_package_slug = 'trial' then
    if p_package_purchase_id is not null then raise exception 'INVALID_TRIAL_ENTITLEMENT'; end if;
    if exists (
      select 1 from public.bookings
      where household_id = p_household_id and lifecycle_status <> 'failed'
    ) or exists (
      select 1 from public.package_purchases
      where household_id = p_household_id and payment_status = 'verified'
    ) then raise exception 'TRIAL_NOT_ALLOWED'; end if;
  else
    if p_package_purchase_id is null then
      -- The client chooses a package, never a mutable entitlement row. Oldest
      -- expiring/oldest created credit is consumed first inside this lock.
      select pp.* into v_purchase
      from public.package_purchases pp
      join public.credit_grants eligible_grant on eligible_grant.id = pp.credit_grant_id
      where pp.household_id = p_household_id
        and pp.package_id = p_package_id
        and pp.payment_status = 'verified'
        and pp.status = 'active'
        and pp.remaining_sessions > 0
        and eligible_grant.valid_from <= now()
        and (eligible_grant.expires_at is null or eligible_grant.expires_at > now())
        and (select coalesce(sum(cl.delta), 0)
             from public.credit_ledger cl
             where cl.credit_grant_id = eligible_grant.id) > 0
      order by eligible_grant.expires_at asc nulls last, eligible_grant.created_at, pp.id
      for update of pp
      limit 1;
    else
      select * into v_purchase from public.package_purchases
      where id = p_package_purchase_id
        and household_id = p_household_id
        and package_id = p_package_id
      for update;
    end if;
    if not found then raise exception 'PACKAGE_REQUIRED'; end if;
    if v_purchase.payment_status <> 'verified' then raise exception 'PAYMENT_NOT_VERIFIED'; end if;
    if v_purchase.status <> 'active' or v_purchase.remaining_sessions <= 0 then
      raise exception 'NO_CREDITS';
    end if;

    select * into strict v_grant from public.credit_grants
    where id = v_purchase.credit_grant_id and package_purchase_id = v_purchase.id;
    select * into strict v_account from public.credit_accounts
    where id = v_grant.credit_account_id for update;
    if v_account.household_id <> p_household_id
       or v_grant.valid_from > now()
       or (v_grant.expires_at is not null and v_grant.expires_at <= now()) then
      raise exception 'NO_CREDITS';
    end if;
    select coalesce(sum(delta), 0)::integer into v_grant_balance
    from public.credit_ledger where credit_grant_id = v_grant.id;
    if v_grant_balance <= 0 then raise exception 'NO_CREDITS'; end if;
  end if;

  insert into public.bookings (
    user_id, household_id, learner_id, created_by_user_id, tutor_id, package_id,
    package_purchase_id, subject_id, starts_at, duration_minutes, time_zone,
    location, location_venue, contact_name, contact_email, contact_phone, message,
    status, lifecycle_status, sync_status, credit_status, credit_grant_id,
    scheduling_provider, idempotency_key, calcom_booking_uid, calcom_event_type_id
  ) values (
    p_user_id, p_household_id, p_learner_id, p_user_id, p_tutor_id, p_package_id,
    v_purchase.id, p_subject_id, p_starts_at, p_duration_minutes, trim(p_time_zone),
    p_location, nullif(trim(p_location_venue), ''), trim(p_contact_name),
    lower(trim(p_contact_email)), nullif(trim(p_contact_phone), ''),
    nullif(trim(p_message), ''), 'scheduled', 'provider_pending', 'pending',
    case when v_grant.id is null then 'none'::public.booking_credit_status
         else 'reserved'::public.booking_credit_status end,
    v_grant.id, 'calcom', p_idempotency_key, null, null
  ) returning * into v_booking;

  if v_grant.id is not null then
    insert into public.credit_ledger (
      credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
      idempotency_key, source_type, source_id, source_action, actor_user_id, note
    ) values (
      v_grant.credit_account_id, v_grant.id, v_booking.id, 'reservation', -1,
      'booking:' || v_booking.id::text || ':reserve',
      'booking', v_booking.id::text, 'reserve', p_user_id,
      'Credit reserved before scheduling-provider creation'
    ) returning id into v_reservation_id;
    update public.bookings set credit_reservation_entry_id = v_reservation_id
    where id = v_booking.id returning * into v_booking;
  end if;

  insert into public.booking_operations (
    booking_id, operation_type, status, idempotency_key, requested_by_user_id,
    expected_booking_version, previous_lifecycle_status, requested_starts_at,
    requested_ends_at, requested_time_zone, request_facts, provider
  ) values (
    v_booking.id, 'create', 'queued', p_idempotency_key, p_user_id,
    v_booking.row_version, null, v_booking.starts_at, v_booking.ends_at,
    v_booking.time_zone, v_request_facts, v_booking.scheduling_provider
  ) returning * into v_operation;

  insert into public.booking_audit_log (
    booking_id, operation_id, action, actor_kind, actor_user_id, after_state
  ) values (
    v_booking.id, v_operation.id, 'credit_reserved_provider_queued', 'user', p_user_id,
    jsonb_build_object(
      'lifecycle_status', v_booking.lifecycle_status,
      'credit_status', v_booking.credit_status,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at
    )
  );

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'operation_id', v_operation.id,
    'operation_status', v_operation.status,
    'lifecycle_status', v_booking.lifecycle_status,
    'credit_status', v_booking.credit_status,
    'starts_at', v_booking.starts_at,
    'replayed', false
  );
end
$$;

create or replace function public.claim_booking_operation(
  p_booking_id uuid,
  p_operation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.booking_operations%rowtype;
begin
  select * into v_operation
  from public.booking_operations
  where id = p_operation_id and booking_id = p_booking_id
  for update;
  if not found then raise exception 'BOOKING_OPERATION_NOT_FOUND'; end if;
  if v_operation.status <> 'queued' then return false; end if;
  if v_operation.operation_type = 'reschedule'
     and not exists (
       select 1
       from public.booking_slot_claims bsc
       where bsc.operation_id = v_operation.id
         and bsc.booking_id = v_operation.booking_id
         and bsc.starts_at = v_operation.requested_starts_at
         and bsc.ends_at = v_operation.requested_ends_at
         and bsc.claim_kind = 'reschedule_hold'
         and bsc.released_at is null
     ) then
    raise exception 'BOOKING_SLOT_HOLD_MISSING';
  end if;

  update public.booking_operations
  set status = 'processing',
      attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now()),
      provider_unchanged_check_count = 0,
      provider_unchanged_last_checked_at = null,
      locked_at = now(),
      locked_by = 'api',
      next_attempt_at = null,
      last_error_code = null,
      last_error_detail = null
  where id = v_operation.id and status = 'queued';
  return found;
end
$$;

create or replace function public.confirm_booking_credit(
  p_booking_id uuid,
  p_operation_id uuid,
  p_provider_booking_id text,
  p_provider_event_type_id integer,
  p_provider_starts_at timestamptz,
  p_provider_ends_at timestamptz default null,
  p_provider_status text default null,
  p_meeting_url text default null,
  p_provider_response jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_operation public.booking_operations%rowtype;
  v_reservation public.credit_ledger%rowtype;
  v_lifecycle public.booking_lifecycle_status;
  v_duration integer;
  v_provider_ends_at timestamptz;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_operation from public.booking_operations
  where id = p_operation_id and booking_id = p_booking_id for update;
  if not found or v_operation.operation_type <> 'create' then
    raise exception 'BOOKING_OPERATION_NOT_FOUND';
  end if;

  if v_operation.status = 'succeeded' then
    if v_operation.provider_booking_id_after is distinct from p_provider_booking_id then
      raise exception 'PROVIDER_BOOKING_ID_MISMATCH';
    end if;
    return jsonb_build_object(
      'booking_id', v_booking.id, 'operation_id', v_operation.id,
      'lifecycle_status', case
        when lower(coalesce(
          v_operation.provider_response ->> '_msm_target_lifecycle',
          v_operation.provider_response ->> 'status', ''
        )) in ('pending', 'pending_confirmation', 'awaiting_host')
          then 'pending_confirmation'
        else 'scheduled' end,
      'sync_status', 'in_sync',
      'credit_status', case when v_booking.credit_grant_id is null then 'none' else 'consumed' end,
      'current_lifecycle_status', v_booking.lifecycle_status,
      'current_sync_status', v_booking.sync_status,
      'current_credit_status', v_booking.credit_status,
      'replayed', true
    );
  end if;
  if v_operation.status = 'failed' then raise exception 'BOOKING_OPERATION_ALREADY_FAILED'; end if;
  v_provider_ends_at := coalesce(
    p_provider_ends_at,
    p_provider_starts_at + (v_booking.duration_minutes * interval '1 minute')
  );
  if nullif(trim(p_provider_booking_id), '') is null
     or p_provider_event_type_id is null or p_provider_event_type_id <= 0
     or p_provider_starts_at is null or v_provider_ends_at <= p_provider_starts_at
     or p_provider_starts_at is distinct from v_operation.requested_starts_at
     or v_provider_ends_at is distinct from v_operation.requested_ends_at then
    raise exception 'INVALID_PROVIDER_CONFIRMATION';
  end if;
  v_duration := extract(epoch from (v_provider_ends_at - p_provider_starts_at))::integer / 60;
  if v_duration not between 15 and 240
     or v_provider_ends_at <> p_provider_starts_at + (v_duration * interval '1 minute') then
    raise exception 'INVALID_PROVIDER_DURATION';
  end if;
  v_lifecycle := case
    when lower(coalesce(p_provider_status, '')) in ('pending', 'pending_confirmation', 'awaiting_host')
      then 'pending_confirmation'::public.booking_lifecycle_status
    else 'scheduled'::public.booking_lifecycle_status
  end;

  if v_booking.credit_status = 'reserved' then
    -- The immutable reservation is the authorization boundary. Once it was
    -- journaled before the provider call, later expiry, refund, or dispute may
    -- revoke only unreserved value; it must not strand a real provider booking.
    perform 1 from public.package_purchases
    where id = v_booking.package_purchase_id
      and credit_grant_id = v_booking.credit_grant_id
    for update;
    if not found then raise exception 'RESERVATION_LINKAGE_INVALID'; end if;
    select cl.* into v_reservation
    from public.credit_ledger cl
    join public.credit_grants cg on cg.id = cl.credit_grant_id
    where cl.id = v_booking.credit_reservation_entry_id
      and cl.booking_id = v_booking.id
      and cl.credit_grant_id = v_booking.credit_grant_id
      and cl.entry_kind = 'reservation'
      and cl.delta = -1
      and cg.package_purchase_id = v_booking.package_purchase_id
    for update of cl;
    if not found then raise exception 'RESERVATION_LINKAGE_INVALID'; end if;

    insert into public.credit_ledger (
      credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
      idempotency_key, source_type, source_id, source_action, actor_user_id, note
    )
    select cg.credit_account_id, cg.id, v_booking.id, 'consumption', 0,
           'booking:' || v_booking.id::text || ':confirm',
           'booking', v_booking.id::text, 'confirm', v_booking.created_by_user_id,
           'Provider creation confirmed; reservation became consumed credit'
    from public.credit_grants cg where cg.id = v_booking.credit_grant_id
    on conflict (idempotency_key) do nothing;

    update public.package_purchases
    set used_sessions = used_sessions + 1,
        remaining_sessions = remaining_sessions - 1,
        status = case
          when payment_status = 'verified' and status in ('active', 'completed')
               and remaining_sessions = 1
            then 'completed'::public.purchase_status
          else status end,
        completed_at = case
          when payment_status = 'verified' and status in ('active', 'completed')
               and remaining_sessions = 1
            then now()
          else completed_at end
    where id = v_booking.package_purchase_id and remaining_sessions > 0;
    if not found then raise exception 'CREDIT_PROJECTION_UPDATE_FAILED'; end if;
  end if;

  update public.bookings
  set starts_at = p_provider_starts_at,
      duration_minutes = v_duration,
      lifecycle_status = v_lifecycle,
      sync_status = 'in_sync',
      credit_status = case when credit_status = 'reserved'
                           then 'consumed'::public.booking_credit_status else credit_status end,
      provider_booking_id = p_provider_booking_id,
      calcom_booking_uid = p_provider_booking_id,
      calcom_event_type_id = p_provider_event_type_id,
      provider_status = nullif(trim(p_provider_status), ''),
      provider_revision = provider_revision + 1,
      provider_last_synced_at = now(),
      meeting_url = nullif(trim(p_meeting_url), ''),
      reconciliation_reason = null
  where id = v_booking.id
  returning * into v_booking;

  update public.booking_operations
  set status = 'succeeded', provider_booking_id_after = p_provider_booking_id,
      provider_response = coalesce(p_provider_response, '{}'::jsonb),
      attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
      completed_at = now(), last_error_code = null, last_error_detail = null
  where id = v_operation.id returning * into v_operation;

  insert into public.booking_audit_log (
    booking_id, operation_id, action, actor_kind, after_state
  ) values (
    v_booking.id, v_operation.id, 'provider_create_confirmed', 'system',
    jsonb_build_object(
      'lifecycle_status', v_booking.lifecycle_status,
      'sync_status', v_booking.sync_status,
      'credit_status', v_booking.credit_status,
      'provider_booking_id', v_booking.provider_booking_id
    )
  );
  return jsonb_build_object(
    'booking_id', v_booking.id, 'operation_id', v_operation.id,
    'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
    'credit_status', v_booking.credit_status, 'replayed', false
  );
end
$$;

create or replace function public.release_booking_credit(
  p_booking_id uuid,
  p_operation_id uuid,
  p_error_code text,
  p_error_detail text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_operation public.booking_operations%rowtype;
  v_reservation public.credit_ledger%rowtype;
  v_release_allowed boolean := false;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_operation from public.booking_operations
  where id = p_operation_id and booking_id = p_booking_id for update;
  if not found or v_operation.operation_type <> 'create' then
    raise exception 'BOOKING_OPERATION_NOT_FOUND';
  end if;
  if v_operation.status = 'failed' and v_booking.lifecycle_status = 'failed' then
    return jsonb_build_object(
      'booking_id', v_booking.id, 'operation_id', v_operation.id,
      'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
      'credit_status', v_booking.credit_status, 'replayed', true
    );
  end if;
  if v_operation.status = 'succeeded' then raise exception 'BOOKING_ALREADY_CONFIRMED'; end if;

  if v_booking.credit_status = 'reserved' then
    perform 1 from public.package_purchases
    where id = v_booking.package_purchase_id for update;
    select exists (
      select 1
      from public.package_purchases pp
      join public.payment_orders po on po.id = pp.payment_order_id
      join public.credit_grants cg on cg.id = pp.credit_grant_id
      where pp.id = v_booking.package_purchase_id
        and pp.payment_status = 'verified' and pp.status = 'active'
        and po.status = 'paid'
        and (cg.expires_at is null or cg.expires_at > now())
    ) into v_release_allowed;
    if v_release_allowed then
      select * into strict v_reservation from public.credit_ledger
      where id = v_booking.credit_reservation_entry_id for update;
      insert into public.credit_ledger (
        credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
        idempotency_key, source_type, source_id, source_action, reverses_entry_id,
        actor_user_id, note
      ) values (
        v_reservation.credit_account_id, v_reservation.credit_grant_id, v_booking.id,
        'release', 1, 'booking:' || v_booking.id::text || ':release',
        'booking', v_booking.id::text, 'release', v_reservation.id,
        v_booking.created_by_user_id, 'Deterministic provider failure released eligible reservation'
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;

  update public.bookings
  set lifecycle_status = 'failed', sync_status = 'failed',
      credit_status = case when credit_status = 'reserved'
                           then 'released'::public.booking_credit_status else credit_status end,
      reconciliation_reason = left(coalesce(nullif(trim(p_error_code), ''), 'PROVIDER_CREATE_FAILED'), 200)
  where id = v_booking.id returning * into v_booking;
  update public.booking_operations
  set status = 'failed', attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now()), completed_at = now(),
      last_error_code = left(nullif(trim(p_error_code), ''), 200),
      last_error_detail = left(nullif(trim(p_error_detail), ''), 2000)
  where id = v_operation.id returning * into v_operation;
  insert into public.booking_audit_log (
    booking_id, operation_id, action, actor_kind, after_state
  ) values (
    v_booking.id, v_operation.id, 'provider_create_failed_reservation_closed', 'system',
    jsonb_build_object(
      'lifecycle_status', v_booking.lifecycle_status,
      'sync_status', v_booking.sync_status,
      'credit_status', v_booking.credit_status,
      'credit_returned', v_release_allowed,
      'error_code', p_error_code
    )
  );
  return jsonb_build_object(
    'booking_id', v_booking.id, 'operation_id', v_operation.id,
    'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
    'credit_status', v_booking.credit_status, 'replayed', false
  );
end
$$;

create or replace function public.record_missing_provider_create(
  p_booking_id uuid,
  p_checked_at timestamptz,
  p_expected_operation_started_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_operation public.booking_operations%rowtype;
  v_checked_at timestamptz := coalesce(p_checked_at, now());
  v_check_count integer;
  v_release jsonb;
begin
  if v_checked_at > now() + interval '5 minutes' then
    raise exception 'INVALID_RECONCILIATION_TIME';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if v_booking.provider_booking_id is not null
     or v_booking.lifecycle_status <> 'provider_pending' then
    return jsonb_build_object(
      'resolved', false,
      'negative_checks', 0,
      'reason', 'BOOKING_NO_LONGER_UIDLESS_PENDING'
    );
  end if;
  if v_checked_at < v_booking.created_at then
    raise exception 'INVALID_RECONCILIATION_TIME';
  end if;

  select * into v_operation
  from public.booking_operations
  where booking_id = v_booking.id
    and operation_type = 'create'
    and status in ('queued', 'processing', 'ambiguous')
  order by created_at
  limit 1
  for update;
  if not found then
    return jsonb_build_object(
      'resolved', false,
      'negative_checks', 0,
      'reason', 'NO_LIVE_CREATE_OPERATION'
    );
  end if;

  if v_operation.started_at is distinct from p_expected_operation_started_at then
    return jsonb_build_object(
      'resolved', false,
      'negative_checks', v_operation.provider_unchanged_check_count,
      'reason', 'PROVIDER_ATTEMPT_CHANGED_DURING_LOOKUP'
    );
  end if;

  if v_operation.provider_unchanged_last_checked_at is not null
     and v_checked_at < v_operation.provider_unchanged_last_checked_at + interval '1 hour' then
    return jsonb_build_object(
      'resolved', false,
      'negative_checks', v_operation.provider_unchanged_check_count,
      'reason', 'NEGATIVE_CHECK_TOO_SOON'
    );
  end if;

  v_check_count := v_operation.provider_unchanged_check_count + 1;
  update public.booking_operations
  set provider_unchanged_check_count = v_check_count,
      provider_unchanged_last_checked_at = v_checked_at
  where id = v_operation.id;

  if v_check_count >= 2
     and coalesce(v_operation.started_at, v_booking.created_at) <=
       v_checked_at - interval '24 hours' then
    v_release := public.release_booking_credit(
      v_booking.id,
      v_operation.id,
      'PROVIDER_CREATE_NOT_FOUND_AFTER_RECONCILIATION',
      'No exact provider booking existed after two complete, spaced negative checks'
    );
    return jsonb_build_object(
      'resolved', true,
      'negative_checks', v_check_count,
      'release', v_release
    );
  end if;

  return jsonb_build_object(
    'resolved', false,
    'negative_checks', v_check_count,
    'reason', 'MORE_NEGATIVE_EVIDENCE_REQUIRED'
  );
end
$$;

create or replace function public.begin_booking_operation(
  p_booking_id uuid,
  p_user_id uuid,
  p_operation_type public.booking_operation_type,
  p_idempotency_key text,
  p_requested_starts_at timestamptz default null,
  p_requested_time_zone text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_operation public.booking_operations%rowtype;
  v_previous public.booking_lifecycle_status;
  v_requested_ends timestamptz;
  v_request_facts jsonb;
begin
  if p_operation_type not in ('reschedule', 'cancel', 'reconcile') then
    raise exception 'INVALID_BOOKING_OPERATION';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(p_idempotency_key) > 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('booking-operation:' || p_idempotency_key, 0));
  v_request_facts := jsonb_build_object(
    'booking_id', p_booking_id,
    'requested_by_user_id', p_user_id,
    'operation_type', p_operation_type,
    'requested_starts_at', p_requested_starts_at,
    'requested_time_zone', nullif(trim(p_requested_time_zone), ''),
    'reason', nullif(trim(p_reason), '')
  );
  -- Read the immutable owner first, then acquire row locks in the global
  -- booking -> operation order used by webhook and reconciliation paths.
  select * into v_operation from public.booking_operations
  where idempotency_key = p_idempotency_key;
  if found then
    select * into strict v_booking from public.bookings
    where id = v_operation.booking_id for update;
    select * into strict v_operation from public.booking_operations
    where idempotency_key = p_idempotency_key for update;
    if v_operation.booking_id <> p_booking_id
       or v_operation.operation_type <> p_operation_type
       or v_operation.requested_by_user_id is distinct from p_user_id
       or v_operation.requested_starts_at is distinct from p_requested_starts_at
       or v_operation.requested_time_zone is distinct from nullif(trim(p_requested_time_zone), '')
       or v_operation.reason is distinct from nullif(trim(p_reason), '')
       or v_operation.request_facts <> v_request_facts then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if not (
      public.has_household_permission_for_user(p_user_id, v_booking.household_id, 'book')
      or public.has_active_account_role(p_user_id, 'admin', null)
      or public.has_active_account_role(p_user_id, 'tutor', v_booking.tutor_id)
    ) then raise exception 'BOOKING_NOT_FOUND'; end if;
    if v_operation.operation_type = 'reschedule'
       and v_operation.status in ('queued', 'processing', 'ambiguous')
       and not exists (
         select 1
         from public.booking_slot_claims bsc
         where bsc.operation_id = v_operation.id
           and bsc.booking_id = v_booking.id
           and bsc.tutor_id = v_booking.tutor_id
           and bsc.starts_at = v_operation.requested_starts_at
           and bsc.ends_at = v_operation.requested_ends_at
           and bsc.claim_kind = 'reschedule_hold'
           and bsc.released_at is null
       ) then
      raise exception 'BOOKING_SLOT_HOLD_MISSING';
    end if;
    return jsonb_build_object(
      'booking_id', v_booking.id, 'operation_id', v_operation.id,
      'operation_type', v_operation.operation_type,
      'operation_status', v_operation.status,
      'provider_booking_id', v_booking.provider_booking_id,
      'booking_version', v_booking.row_version,
      'replayed', true
    );
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not (
    public.has_household_permission_for_user(p_user_id, v_booking.household_id, 'book')
    or public.has_active_account_role(p_user_id, 'admin', null)
    or public.has_active_account_role(p_user_id, 'tutor', v_booking.tutor_id)
  ) then raise exception 'BOOKING_NOT_FOUND'; end if;
  if exists (
    select 1 from public.booking_operations
    where booking_id = p_booking_id and status in ('queued', 'processing', 'ambiguous')
  ) then raise exception 'BOOKING_OPERATION_IN_PROGRESS'; end if;

  if p_operation_type in ('cancel', 'reschedule') then
    if v_booking.lifecycle_status not in ('scheduled', 'pending_confirmation')
       or v_booking.starts_at <= now() then
      raise exception 'BOOKING_NOT_MUTABLE';
    end if;
  end if;
  if p_operation_type = 'reschedule' then
    if p_requested_starts_at is null or p_requested_starts_at <= now() then
      raise exception 'INVALID_START_TIME';
    end if;
    if nullif(trim(p_requested_time_zone), '') is null then
      raise exception 'INVALID_TIME_ZONE';
    end if;
    v_requested_ends := p_requested_starts_at + (v_booking.duration_minutes * interval '1 minute');
  end if;

  v_previous := v_booking.lifecycle_status;
  update public.bookings
  set lifecycle_status = case p_operation_type
        when 'cancel' then 'cancellation_pending'::public.booking_lifecycle_status
        when 'reschedule' then 'reschedule_pending'::public.booking_lifecycle_status
        else lifecycle_status
      end,
      sync_status = 'pending', reconciliation_reason = null
  where id = v_booking.id returning * into v_booking;

  insert into public.booking_operations (
    booking_id, operation_type, status, idempotency_key, requested_by_user_id,
    expected_booking_version, previous_lifecycle_status, requested_starts_at,
    requested_ends_at, requested_time_zone, reason, request_facts, provider,
    provider_booking_id_before
  ) values (
    v_booking.id, p_operation_type, 'queued', p_idempotency_key, p_user_id,
    v_booking.row_version, v_previous, p_requested_starts_at, v_requested_ends,
    nullif(trim(p_requested_time_zone), ''), nullif(trim(p_reason), ''),
    v_request_facts, v_booking.scheduling_provider, v_booking.provider_booking_id
  ) returning * into v_operation;

  if p_operation_type = 'reschedule' then
    insert into public.booking_slot_claims (
      booking_id, operation_id, tutor_id, starts_at, ends_at, claim_kind
    ) values (
      v_booking.id, v_operation.id, v_booking.tutor_id,
      v_operation.requested_starts_at, v_operation.requested_ends_at,
      'reschedule_hold'
    );
  end if;

  insert into public.booking_audit_log (
    booking_id, operation_id, action, actor_kind, actor_user_id, before_state, after_state
  ) values (
    v_booking.id, v_operation.id, 'operation_queued', 'user', p_user_id,
    jsonb_build_object('lifecycle_status', v_previous),
    jsonb_build_object(
      'lifecycle_status', v_booking.lifecycle_status,
      'sync_status', v_booking.sync_status,
      'operation_type', p_operation_type
    )
  );
  return jsonb_build_object(
    'booking_id', v_booking.id, 'operation_id', v_operation.id,
    'operation_type', v_operation.operation_type,
    'operation_status', v_operation.status,
    'provider_booking_id', v_booking.provider_booking_id,
    'booking_version', v_booking.row_version,
    'replayed', false
  );
end
$$;

create or replace function public.complete_booking_operation(
  p_operation_id uuid,
  p_provider_booking_id text default null,
  p_provider_starts_at timestamptz default null,
  p_provider_ends_at timestamptz default null,
  p_provider_status text default null,
  p_meeting_url text default null,
  p_provider_response jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.booking_operations%rowtype;
  v_booking public.bookings%rowtype;
  v_booking_id uuid;
  v_before jsonb;
  v_duration integer;
  v_credit_return_allowed boolean := false;
  v_reservation public.credit_ledger%rowtype;
  v_entry_kind public.credit_entry_kind;
begin
  select booking_id into v_booking_id
  from public.booking_operations
  where id = p_operation_id;
  if not found then raise exception 'BOOKING_OPERATION_NOT_FOUND'; end if;
  select * into v_booking from public.bookings
  where id = v_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_operation from public.booking_operations
  where id = p_operation_id for update;
  if not found
     or v_operation.booking_id <> v_booking.id
     or v_operation.operation_type = 'create' then
    raise exception 'BOOKING_OPERATION_NOT_FOUND';
  end if;
  if v_operation.status = 'succeeded' then
    if v_operation.operation_type = 'reschedule' then
      update public.booking_slot_claims
      set released_at = now(), release_reason = 'RESCHEDULE_COMMITTED'
      where operation_id = v_operation.id and released_at is null;
    end if;
    return jsonb_build_object(
      'booking_id', v_booking.id, 'operation_id', v_operation.id,
      'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
      'credit_status', v_booking.credit_status, 'booking_version', v_booking.row_version,
      'replayed', true
    );
  end if;
  if v_operation.status = 'failed' then raise exception 'BOOKING_OPERATION_ALREADY_FAILED'; end if;
  v_before := jsonb_build_object(
    'lifecycle_status', v_booking.lifecycle_status,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'credit_status', v_booking.credit_status,
    'provider_booking_id', v_booking.provider_booking_id
  );

  if v_operation.operation_type = 'reschedule' then
    if not exists (
      select 1
      from public.booking_slot_claims bsc
      where bsc.operation_id = v_operation.id
        and bsc.booking_id = v_booking.id
        and bsc.tutor_id = v_booking.tutor_id
        and bsc.starts_at = v_operation.requested_starts_at
        and bsc.ends_at = v_operation.requested_ends_at
        and bsc.claim_kind = 'reschedule_hold'
        and bsc.released_at is null
    ) then
      raise exception 'BOOKING_SLOT_HOLD_MISSING';
    end if;
    if p_provider_starts_at is null or p_provider_ends_at is null
       or p_provider_ends_at <= p_provider_starts_at
       or p_provider_starts_at is distinct from v_operation.requested_starts_at
       or p_provider_ends_at is distinct from v_operation.requested_ends_at then
      raise exception 'INVALID_PROVIDER_CONFIRMATION';
    end if;
    v_duration := extract(epoch from (p_provider_ends_at - p_provider_starts_at))::integer / 60;
    if v_duration not between 15 and 240
       or p_provider_ends_at <> p_provider_starts_at + (v_duration * interval '1 minute') then
      raise exception 'INVALID_PROVIDER_DURATION';
    end if;
    update public.bookings
    set starts_at = p_provider_starts_at,
        duration_minutes = v_duration,
        time_zone = coalesce(v_operation.requested_time_zone, time_zone),
        lifecycle_status = case
          when lower(coalesce(p_provider_status, '')) in ('pending', 'pending_confirmation', 'awaiting_host')
            then 'pending_confirmation'::public.booking_lifecycle_status
          else 'scheduled'::public.booking_lifecycle_status end,
        sync_status = 'in_sync',
        provider_booking_id = coalesce(nullif(trim(p_provider_booking_id), ''), provider_booking_id),
        calcom_booking_uid = coalesce(nullif(trim(p_provider_booking_id), ''), calcom_booking_uid),
        provider_status = coalesce(nullif(trim(p_provider_status), ''), provider_status),
        provider_revision = provider_revision + 1,
        provider_last_synced_at = now(),
        meeting_url = coalesce(nullif(trim(p_meeting_url), ''), meeting_url),
        reconciliation_reason = null
    where id = v_booking.id returning * into v_booking;
    update public.booking_slot_claims
    set released_at = now(), release_reason = 'RESCHEDULE_COMMITTED'
    where operation_id = v_operation.id
      and claim_kind = 'reschedule_hold'
      and released_at is null;
    if not found then raise exception 'BOOKING_SLOT_HOLD_MISSING'; end if;
  elsif v_operation.operation_type = 'cancel' then
    if v_booking.credit_status in ('reserved', 'consumed') then
      perform 1 from public.package_purchases
      where id = v_booking.package_purchase_id for update;
      select exists (
        select 1
        from public.package_purchases pp
        join public.payment_orders po on po.id = pp.payment_order_id
        join public.credit_grants cg on cg.id = pp.credit_grant_id
        where pp.id = v_booking.package_purchase_id
          and pp.payment_status = 'verified'
          and pp.status in ('active', 'completed')
          and po.status = 'paid'
          and (cg.expires_at is null or cg.expires_at > now())
      ) into v_credit_return_allowed;

      if v_credit_return_allowed then
        select * into strict v_reservation from public.credit_ledger
        where id = v_booking.credit_reservation_entry_id for update;
        v_entry_kind := case when v_booking.credit_status = 'reserved'
          then 'release'::public.credit_entry_kind
          else 'cancellation_restore'::public.credit_entry_kind end;
        insert into public.credit_ledger (
          credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
          idempotency_key, source_type, source_id, source_action,
          reverses_entry_id, actor_user_id, note
        ) values (
          v_reservation.credit_account_id, v_reservation.credit_grant_id, v_booking.id,
          v_entry_kind, 1, 'booking:' || v_booking.id::text || ':cancel-restore',
          'booking', v_booking.id::text, 'cancel_restore', v_reservation.id,
          v_operation.requested_by_user_id, 'Eligible cancellation restored one credit'
        ) on conflict (idempotency_key) do nothing;

        if v_booking.credit_status = 'consumed' then
          update public.package_purchases
          set used_sessions = used_sessions - 1,
              remaining_sessions = remaining_sessions + 1,
              status = 'active', completed_at = null
          where id = v_booking.package_purchase_id and used_sessions > 0;
          if not found then raise exception 'CREDIT_PROJECTION_RESTORE_FAILED'; end if;
        end if;
      end if;
    end if;

    update public.bookings
    set lifecycle_status = 'cancelled', sync_status = 'in_sync',
        credit_status = case
          when credit_status in ('reserved', 'consumed') and v_credit_return_allowed
            then 'restored'::public.booking_credit_status
          when credit_status in ('reserved', 'consumed')
            then 'released'::public.booking_credit_status
          else credit_status end,
        provider_booking_id = coalesce(nullif(trim(p_provider_booking_id), ''), provider_booking_id),
        calcom_booking_uid = coalesce(nullif(trim(p_provider_booking_id), ''), calcom_booking_uid),
        provider_status = coalesce(nullif(trim(p_provider_status), ''), 'cancelled'),
        provider_revision = provider_revision + 1,
        provider_last_synced_at = now(), reconciliation_reason = null
    where id = v_booking.id returning * into v_booking;
  else
    update public.bookings
    set sync_status = 'in_sync',
        provider_booking_id = coalesce(nullif(trim(p_provider_booking_id), ''), provider_booking_id),
        calcom_booking_uid = coalesce(nullif(trim(p_provider_booking_id), ''), calcom_booking_uid),
        provider_status = coalesce(nullif(trim(p_provider_status), ''), provider_status),
        provider_revision = provider_revision + 1,
        provider_last_synced_at = now(), reconciliation_reason = null
    where id = v_booking.id returning * into v_booking;
  end if;

  update public.booking_operations
  set status = 'succeeded', provider_booking_id_after = v_booking.provider_booking_id,
      provider_response = coalesce(p_provider_response, '{}'::jsonb),
      attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
      completed_at = now(), last_error_code = null, last_error_detail = null
  where id = v_operation.id returning * into v_operation;
  insert into public.booking_audit_log (
    booking_id, operation_id, action, actor_kind, actor_user_id, before_state, after_state
  ) values (
    v_booking.id, v_operation.id, 'operation_completed', 'system',
    v_operation.requested_by_user_id, v_before,
    jsonb_build_object(
      'lifecycle_status', v_booking.lifecycle_status,
      'sync_status', v_booking.sync_status,
      'credit_status', v_booking.credit_status,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'provider_booking_id', v_booking.provider_booking_id
    )
  );
  return jsonb_build_object(
    'booking_id', v_booking.id, 'operation_id', v_operation.id,
    'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
    'credit_status', v_booking.credit_status, 'booking_version', v_booking.row_version,
    'replayed', false
  );
end
$$;

create or replace function public.fail_booking_operation(
  p_operation_id uuid,
  p_is_ambiguous boolean,
  p_error_code text,
  p_error_detail text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.booking_operations%rowtype;
  v_booking public.bookings%rowtype;
  v_booking_id uuid;
begin
  select booking_id into v_booking_id
  from public.booking_operations
  where id = p_operation_id;
  if not found then raise exception 'BOOKING_OPERATION_NOT_FOUND'; end if;
  select * into v_booking from public.bookings
  where id = v_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into v_operation from public.booking_operations
  where id = p_operation_id for update;
  if not found
     or v_operation.booking_id <> v_booking.id
     or (v_operation.operation_type = 'create' and not p_is_ambiguous) then
    raise exception 'BOOKING_OPERATION_NOT_FOUND';
  end if;
  if v_operation.status = 'failed'
     or (v_operation.status = 'ambiguous' and p_is_ambiguous) then
    if v_operation.operation_type = 'reschedule'
       and v_operation.status = 'failed' then
      update public.booking_slot_claims
      set released_at = now(), release_reason = 'RESCHEDULE_FAILED'
      where operation_id = v_operation.id and released_at is null;
    end if;
    return jsonb_build_object(
      'booking_id', v_booking.id, 'operation_id', v_operation.id,
      'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
      'credit_status', v_booking.credit_status, 'booking_version', v_booking.row_version,
      'replayed', true
    );
  end if;
  if v_operation.status = 'succeeded' then raise exception 'BOOKING_OPERATION_ALREADY_SUCCEEDED'; end if;

  update public.booking_operations
  set status = case when p_is_ambiguous then 'ambiguous'::public.booking_operation_status
                    else 'failed'::public.booking_operation_status end,
      attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
      completed_at = case when p_is_ambiguous then null else now() end,
      last_error_code = left(nullif(trim(p_error_code), ''), 200),
      last_error_detail = left(nullif(trim(p_error_detail), ''), 2000)
  where id = v_operation.id returning * into v_operation;
  update public.bookings
  set lifecycle_status = case when p_is_ambiguous then lifecycle_status
                              else coalesce(v_operation.previous_lifecycle_status, lifecycle_status) end,
      sync_status = case when p_is_ambiguous
                         then 'needs_reconciliation'::public.booking_sync_status
                         else 'in_sync'::public.booking_sync_status end,
      reconciliation_reason = case when p_is_ambiguous
        then left(coalesce(nullif(trim(p_error_code), ''), 'AMBIGUOUS_PROVIDER_RESULT'), 200)
        else null end
  where id = v_booking.id returning * into v_booking;
  if v_operation.operation_type = 'reschedule' and not p_is_ambiguous then
    update public.booking_slot_claims
    set released_at = now(), release_reason = 'RESCHEDULE_FAILED'
    where operation_id = v_operation.id
      and claim_kind = 'reschedule_hold'
      and released_at is null;
    if not found then raise exception 'BOOKING_SLOT_HOLD_MISSING'; end if;
  end if;
  insert into public.booking_audit_log (
    booking_id, operation_id, action, actor_kind, actor_user_id, after_state
  ) values (
    v_booking.id, v_operation.id,
    case when p_is_ambiguous then 'operation_ambiguous' else 'operation_failed' end,
    'system', v_operation.requested_by_user_id,
    jsonb_build_object(
      'lifecycle_status', v_booking.lifecycle_status,
      'sync_status', v_booking.sync_status,
      'error_code', p_error_code
    )
  );
  return jsonb_build_object(
    'booking_id', v_booking.id, 'operation_id', v_operation.id,
    'lifecycle_status', v_booking.lifecycle_status, 'sync_status', v_booking.sync_status,
    'credit_status', v_booking.credit_status, 'booking_version', v_booking.row_version,
    'replayed', false
  );
end
$$;

create or replace function public.process_provider_booking_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_booking_id uuid default null,
  p_provider_booking_id text default null,
  p_occurred_at timestamptz default null,
  p_target_lifecycle public.booking_lifecycle_status default null,
  p_provider_starts_at timestamptz default null,
  p_provider_ends_at timestamptz default null,
  p_provider_status text default null,
  p_meeting_url text default null,
  p_payload jsonb default '{}'::jsonb,
  p_payload_sha256 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.provider_events%rowtype;
  v_booking public.bookings%rowtype;
  v_live_operation public.booking_operations%rowtype;
  v_target public.booking_lifecycle_status := p_target_lifecycle;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_end timestamptz;
  v_duration integer;
  v_reservation public.credit_ledger%rowtype;
  v_credit_allowed boolean := false;
  v_inserted_credit integer := 0;
  v_unchanged_check_count integer := 0;
  v_live_operation_superseded boolean := false;
  v_external_cancellation_staged boolean := false;
  v_reschedule_source_uid text := nullif(trim(coalesce(
    p_payload #>> '{payload,rescheduleUid}',
    p_payload #>> '{payload,rescheduledFromUid}',
    p_payload ->> 'rescheduleUid',
    p_payload ->> 'rescheduledFromUid'
  )), '');
  v_error text;
begin
  if nullif(trim(p_provider), '') is null
     or nullif(trim(p_provider_event_id), '') is null
     or nullif(trim(p_event_type), '') is null
     or p_payload is null
     or (p_payload_sha256 is not null and p_payload_sha256 !~ '^[0-9a-f]{64}$') then
    raise exception 'INVALID_PROVIDER_EVENT';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('provider-event:' || p_provider || ':' || p_provider_event_id, 0)
  );

  select * into v_event from public.provider_events
  where provider = p_provider and provider_event_id = p_provider_event_id for update;
  if found then
    if v_event.event_type <> p_event_type
       or v_event.payload <> p_payload
       or v_event.payload_sha256 is distinct from p_payload_sha256 then
      raise exception 'PROVIDER_EVENT_ID_COLLISION';
    end if;
    if v_event.status in ('processed', 'ignored') then
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_event.booking_id,
        'event_status', v_event.status, 'replayed', true
      );
    end if;
  else
    insert into public.provider_events (
      provider, provider_event_id, event_type, booking_id, provider_booking_id,
      occurred_at, payload, payload_sha256
    ) values (
      p_provider, p_provider_event_id, p_event_type, p_booking_id,
      nullif(trim(p_provider_booking_id), ''), v_occurred_at, p_payload,
      p_payload_sha256
    ) returning * into v_event;
  end if;

  if p_booking_id is not null then
    select * into v_booking from public.bookings where id = p_booking_id for update;
  else
    select b.* into v_booking
    from public.bookings b
    where b.scheduling_provider = p_provider
      and b.provider_booking_id = p_provider_booking_id
    for update;
    if not found then
      select b.* into v_booking
      from public.booking_operations bo
      join public.bookings b on b.id = bo.booking_id
      where bo.provider = p_provider
        and p_provider_booking_id in (bo.provider_booking_id_before, bo.provider_booking_id_after)
      order by bo.created_at desc
      limit 1
      for update of b;
    end if;
    if not found and v_reschedule_source_uid is not null then
      select * into v_booking
      from public.bookings
      where scheduling_provider = p_provider
        and provider_booking_id = v_reschedule_source_uid
      for update;
    end if;
    if not found and v_reschedule_source_uid is not null then
      select b.* into v_booking
      from public.booking_operations bo
      join public.bookings b on b.id = bo.booking_id
      where bo.provider = p_provider
        and bo.operation_type = 'reschedule'
        and v_reschedule_source_uid = coalesce(bo.provider_booking_id_before, b.provider_booking_id)
      order by bo.created_at desc
      limit 1
      for update of b;
    end if;
    if not found then
      select b.* into v_booking
      from public.provider_events pe
      join public.bookings b on b.id = pe.booking_id
      where pe.provider = p_provider
        and pe.status = 'processed'
        and pe.provider_booking_id = b.provider_booking_id
        and p_provider_booking_id = coalesce(
          pe.payload #>> '{payload,rescheduleUid}',
          pe.payload #>> '{payload,rescheduledFromUid}',
          pe.payload ->> 'rescheduleUid',
          pe.payload ->> 'rescheduledFromUid'
        )
      order by pe.processed_at desc
      limit 1
      for update of b;
    end if;
  end if;
  if not found then
    update public.provider_events
    set status = 'failed', attempt_count = attempt_count + 1,
        last_error = 'BOOKING_NOT_FOUND'
    where id = v_event.id;
    return jsonb_build_object(
      'provider_event_id', v_event.id, 'booking_id', null,
      'event_status', 'failed', 'error', 'BOOKING_NOT_FOUND', 'replayed', false
    );
  end if;

  select * into v_live_operation
  from public.booking_operations
  where booking_id = v_booking.id
    and status in ('queued', 'processing', 'ambiguous')
  order by created_at
  limit 1
  for update;

  -- Once a replacement UID is authoritative, every event for a superseded
  -- source UID is historical and must never mutate the current booking.
  if p_provider_booking_id is not null
     and v_booking.provider_booking_id is not null
     and v_booking.provider_booking_id <> p_provider_booking_id
     and (
       exists (
         select 1 from public.booking_operations bo
         where bo.booking_id = v_booking.id
           and bo.operation_type = 'reschedule'
           and bo.status = 'succeeded'
           and bo.provider_booking_id_before = p_provider_booking_id
       )
       or exists (
         select 1 from public.provider_events pe
         where pe.booking_id = v_booking.id
           and pe.status = 'processed'
           and pe.provider_booking_id = v_booking.provider_booking_id
           and p_provider_booking_id = coalesce(
             pe.payload #>> '{payload,rescheduleUid}',
             pe.payload #>> '{payload,rescheduledFromUid}',
             pe.payload ->> 'rescheduleUid',
             pe.payload ->> 'rescheduledFromUid'
           )
       )
     ) then
    update public.provider_events
    set booking_id = v_booking.id,
        provider_booking_id = p_provider_booking_id,
        status = 'ignored', processed_at = now(),
        attempt_count = attempt_count + 1,
        last_error = 'SUPERSEDED_RESCHEDULE_SOURCE_UID'
    where id = v_event.id;
    return jsonb_build_object(
      'provider_event_id', v_event.id, 'booking_id', v_booking.id,
      'event_status', 'ignored', 'replayed', false
    );
  end if;

  if p_provider_booking_id is not null
     and v_booking.provider_booking_id is not null
     and v_booking.provider_booking_id <> p_provider_booking_id
     and not exists (
       select 1 from public.booking_operations bo
       where bo.booking_id = v_booking.id
         and p_provider_booking_id in (bo.provider_booking_id_before, bo.provider_booking_id_after)
     )
     and not (
       v_live_operation.id is not null
       and v_live_operation.operation_type = 'reschedule'
       and v_reschedule_source_uid = coalesce(
         v_live_operation.provider_booking_id_before,
         v_booking.provider_booking_id
       )
       and p_provider_booking_id <> v_reschedule_source_uid
     )
     and not (
       v_reschedule_source_uid = v_booking.provider_booking_id
       and p_provider_booking_id <> v_reschedule_source_uid
     ) then
    update public.provider_events
    set booking_id = v_booking.id, status = 'failed', attempt_count = attempt_count + 1,
        last_error = 'PROVIDER_BOOKING_ID_MISMATCH'
    where id = v_event.id;
    return jsonb_build_object(
      'provider_event_id', v_event.id, 'booking_id', v_booking.id,
      'event_status', 'failed', 'error', 'PROVIDER_BOOKING_ID_MISMATCH', 'replayed', false
    );
  end if;

  update public.provider_events
  set booking_id = v_booking.id,
      provider_booking_id = coalesce(nullif(trim(p_provider_booking_id), ''), provider_booking_id),
      status = 'processing', attempt_count = attempt_count + 1, last_error = null
  where id = v_event.id returning * into v_event;

  begin
    if v_target is null then
      v_target := case
        when lower(p_event_type) similar to '%(cancel|cancelled|canceled)%'
          then 'cancelled'::public.booking_lifecycle_status
        when lower(p_event_type) similar to '%(complete|completed|meeting_ended)%'
          then 'completed'::public.booking_lifecycle_status
        when lower(p_event_type) similar to '%(reject|rejected|fail|failed)%'
          then 'failed'::public.booking_lifecycle_status
        when lower(p_event_type) similar to '%(create|created|confirm|confirmed|reschedul|booked)%'
          then 'scheduled'::public.booking_lifecycle_status
        else null
      end;
    end if;
    if v_target is null then
      update public.provider_events
      set status = 'ignored', processed_at = now(), last_error = 'UNMAPPED_EVENT_TYPE'
      where id = v_event.id;
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_booking.id,
        'event_status', 'ignored', 'replayed', false
      );
    end if;

    -- Cal.com can represent a reschedule as cancellation of the source UID plus
    -- creation of a replacement UID. The source cancellation is transitional,
    -- not a cancellation of the user's lesson or its credit.
    if v_live_operation.id is not null
       and v_live_operation.operation_type = 'reschedule'
       and v_target = 'cancelled'
       and p_provider_booking_id = v_live_operation.provider_booking_id_before
       and coalesce(p_payload ->> 'mutationTerminalEvidence', 'false') <> 'true' then
      update public.provider_events
      set status = 'ignored', processed_at = now(),
          last_error = 'RESCHEDULE_SOURCE_CANCELLED'
      where id = v_event.id;
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_booking.id,
        'event_status', 'ignored', 'replayed', false
      );
    end if;

    -- A provider-side cancellation is first staged and then confirmed by the
    -- reconciliation GET. This avoids treating the retired UID of an external
    -- reschedule as a cancelled lesson.
    if v_target = 'cancelled'
       and v_live_operation.id is null
       and p_event_type <> 'RECONCILIATION_SNAPSHOT' then
      v_target := 'cancellation_pending';
      v_external_cancellation_staged := true;
    end if;

    -- An active provider event can race with an outbound cancellation that has
    -- not returned yet. It is not proof that the cancel failed, so preserve the
    -- local pending state until completion, cancellation evidence, or repeated
    -- unchanged reconciliation snapshots settle it.
    if v_live_operation.id is not null
       and v_live_operation.operation_type = 'cancel'
       and v_target in ('scheduled', 'pending_confirmation') then
      if p_provider_booking_id = v_live_operation.provider_booking_id_before then
        v_target := 'cancellation_pending';
      elsif v_reschedule_source_uid = v_live_operation.provider_booking_id_before then
        update public.booking_operations
        set status = 'failed',
            provider_booking_id_after = p_provider_booking_id,
            provider_response = p_payload || jsonb_build_object(
              '_msm_target_lifecycle', v_target,
              '_msm_resolution', 'superseded_by_provider_reschedule'
            ),
            attempt_count = attempt_count + 1,
            started_at = coalesce(started_at, now()), completed_at = now(),
            next_attempt_at = null,
            last_error_code = 'PROVIDER_CANCEL_SUPERSEDED_BY_RESCHEDULE',
            last_error_detail = 'Provider created a lineage-linked replacement while cancellation was pending'
        where id = v_live_operation.id
        returning * into v_live_operation;
        v_live_operation_superseded := true;

        insert into public.booking_audit_log (
          booking_id, operation_id, provider_event_id, action, actor_kind, after_state
        ) values (
          v_booking.id, v_live_operation.id, v_event.id,
          'cancel_superseded_by_provider_reschedule', 'system',
          jsonb_build_object(
            'provider_booking_id', p_provider_booking_id,
            'rescheduled_from_uid', v_reschedule_source_uid,
            'error_code', 'PROVIDER_CANCEL_SUPERSEDED_BY_RESCHEDULE'
          )
        );
      end if;
    end if;

    -- A live reschedule is only proven by a lineage-linked replacement UID or
    -- by the original UID reporting the exact requested start time.
    if v_live_operation.id is not null
       and v_live_operation.operation_type = 'reschedule'
       and v_target in ('scheduled', 'pending_confirmation', 'completed')
       and not (
         (
           p_provider_starts_at is not null
           and p_provider_ends_at is not null
           and p_provider_starts_at = v_live_operation.requested_starts_at
           and p_provider_ends_at = v_live_operation.requested_ends_at
           and (
             (
               p_provider_booking_id <> v_live_operation.provider_booking_id_before
               and v_reschedule_source_uid = v_live_operation.provider_booking_id_before
             )
             or p_provider_booking_id = v_live_operation.provider_booking_id_before
           )
         )
         or
         (
           p_event_type = 'RECONCILIATION_SNAPSHOT'
           and v_reschedule_source_uid = v_live_operation.provider_booking_id_before
           and nullif(p_payload ->> 'lineageFirstReplacementUid', '') is not null
           and (p_payload ->> 'lineageFirstReplacementStartsAt')::timestamptz =
             v_live_operation.requested_starts_at
           and (p_payload ->> 'lineageFirstReplacementEndsAt')::timestamptz =
             v_live_operation.requested_ends_at
         )
       ) then
      if p_event_type = 'RECONCILIATION_SNAPSHOT'
         and p_provider_starts_at is not null
         and p_provider_ends_at is not null
         and (
           p_provider_booking_id = v_live_operation.provider_booking_id_before
           or v_reschedule_source_uid = v_live_operation.provider_booking_id_before
         ) then
        -- The provider state is authoritative but it did not apply the exact
        -- requested mutation. Fail that operation and continue to adopt the
        -- provider's actual current tail so the booking cannot remain blocked.
        update public.booking_operations
        set status = 'failed',
            provider_booking_id_after = p_provider_booking_id,
            provider_response = p_payload || jsonb_build_object(
              '_msm_target_lifecycle', v_target,
              '_msm_resolution', 'superseded_by_provider_state'
            ),
            attempt_count = attempt_count + 1,
            started_at = coalesce(started_at, now()), completed_at = now(),
            next_attempt_at = null,
            last_error_code = 'PROVIDER_RESCHEDULE_SUPERSEDED',
            last_error_detail = 'Authoritative provider state did not match the requested interval'
        where id = v_live_operation.id
        returning * into v_live_operation;
        v_live_operation_superseded := true;

        insert into public.booking_audit_log (
          booking_id, operation_id, provider_event_id, action, actor_kind, after_state
        ) values (
          v_booking.id, v_live_operation.id, v_event.id,
          'operation_superseded_by_provider_state', 'system',
          jsonb_build_object(
            'provider_booking_id', p_provider_booking_id,
            'provider_starts_at', p_provider_starts_at,
            'provider_ends_at', p_provider_ends_at,
            'error_code', 'PROVIDER_RESCHEDULE_SUPERSEDED'
          )
        );
      else
        update public.provider_events
        set status = 'ignored', processed_at = now(),
            last_error = 'RESCHEDULE_RESULT_NOT_PROVEN'
        where id = v_event.id;
        return jsonb_build_object(
          'provider_event_id', v_event.id, 'booking_id', v_booking.id,
          'event_status', 'ignored', 'replayed', false
        );
      end if;
    end if;

    if v_live_operation.id is not null
       and v_live_operation.operation_type = 'create'
       and v_target in ('scheduled', 'pending_confirmation', 'completed')
       and not (
         p_provider_starts_at is not null
         and p_provider_ends_at is not null
         and p_provider_starts_at = v_live_operation.requested_starts_at
         and p_provider_ends_at = v_live_operation.requested_ends_at
       ) then
      update public.provider_events
      set status = 'failed', processed_at = null,
          last_error = 'CREATE_INTERVAL_MISMATCH'
      where id = v_event.id;
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_booking.id,
        'event_status', 'failed', 'error', 'CREATE_INTERVAL_MISMATCH', 'replayed', false
      );
    end if;

    if v_target in ('scheduled', 'pending_confirmation', 'completed')
       and p_provider_starts_at is not null
       and p_provider_ends_at is not null
       and p_provider_ends_at <> p_provider_starts_at +
         (v_booking.duration_minutes * interval '1 minute') then
      update public.provider_events
      set status = 'failed', processed_at = null,
          last_error = 'PROVIDER_DURATION_MISMATCH'
      where id = v_event.id;
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_booking.id,
        'event_status', 'failed', 'error', 'PROVIDER_DURATION_MISMATCH', 'replayed', false
      );
    end if;

    if v_booking.provider_last_synced_at is not null
       and v_occurred_at < v_booking.provider_last_synced_at then
      update public.provider_events
      set status = 'ignored', processed_at = now(), last_error = 'STALE_PROVIDER_EVENT'
      where id = v_event.id;
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_booking.id,
        'event_status', 'ignored', 'replayed', false
      );
    end if;

    -- Terminal application state is monotonic. A late create/reschedule event must
    -- not resurrect a cancelled, completed, or deterministically failed booking.
    if v_booking.lifecycle_status in ('cancelled', 'completed', 'failed')
       and v_target <> v_booking.lifecycle_status then
      update public.provider_events
      set status = 'ignored', processed_at = now(), last_error = 'TERMINAL_STATE_NOT_REOPENED'
      where id = v_event.id;
      return jsonb_build_object(
        'provider_event_id', v_event.id, 'booking_id', v_booking.id,
        'event_status', 'ignored', 'replayed', false
      );
    end if;

    if v_target in ('scheduled', 'pending_confirmation', 'completed') then
      if v_booking.credit_status = 'reserved' then
        perform 1 from public.package_purchases
        where id = v_booking.package_purchase_id
          and credit_grant_id = v_booking.credit_grant_id
        for update;
        if not found then raise exception 'RESERVATION_LINKAGE_INVALID'; end if;
        select cl.* into v_reservation
        from public.credit_ledger cl
        join public.credit_grants cg on cg.id = cl.credit_grant_id
        where cl.id = v_booking.credit_reservation_entry_id
          and cl.booking_id = v_booking.id
          and cl.credit_grant_id = v_booking.credit_grant_id
          and cl.entry_kind = 'reservation'
          and cl.delta = -1
          and cg.package_purchase_id = v_booking.package_purchase_id
        for update of cl;
        if not found then raise exception 'RESERVATION_LINKAGE_INVALID'; end if;
        insert into public.credit_ledger (
          credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
          idempotency_key, source_type, source_id, source_action,
          provider_event_id, note
        )
        select cg.credit_account_id, cg.id, v_booking.id, 'consumption', 0,
               'booking:' || v_booking.id::text || ':confirm',
               'booking', v_booking.id::text, 'confirm', v_event.id,
               'Provider webhook confirmed reserved booking credit'
        from public.credit_grants cg where cg.id = v_booking.credit_grant_id
        on conflict (idempotency_key) do nothing;
        get diagnostics v_inserted_credit = row_count;
        if v_inserted_credit > 0 then
          update public.package_purchases
          set used_sessions = used_sessions + 1,
              remaining_sessions = remaining_sessions - 1,
              status = case
                when payment_status = 'verified' and status in ('active', 'completed')
                     and remaining_sessions = 1
                  then 'completed'::public.purchase_status
                else status end,
              completed_at = case
                when payment_status = 'verified' and status in ('active', 'completed')
                     and remaining_sessions = 1
                  then now()
                else completed_at end
          where id = v_booking.package_purchase_id and remaining_sessions > 0;
          if not found then raise exception 'CREDIT_PROJECTION_UPDATE_FAILED'; end if;
        end if;
      end if;

      v_end := coalesce(
        p_provider_ends_at,
        p_provider_starts_at + (v_booking.duration_minutes * interval '1 minute'),
        v_booking.ends_at
      );
      if p_provider_starts_at is not null then
        if v_end <= p_provider_starts_at then raise exception 'INVALID_PROVIDER_DURATION'; end if;
        v_duration := extract(epoch from (v_end - p_provider_starts_at))::integer / 60;
        if v_duration not between 15 and 240
           or v_end <> p_provider_starts_at + (v_duration * interval '1 minute') then
          raise exception 'INVALID_PROVIDER_DURATION';
        end if;
      else
        v_duration := v_booking.duration_minutes;
      end if;
      update public.bookings
      set starts_at = coalesce(p_provider_starts_at, starts_at),
          ends_at = v_end,
          duration_minutes = v_duration,
          lifecycle_status = v_target,
          sync_status = 'in_sync',
          credit_status = case when credit_status = 'reserved'
                               then 'consumed'::public.booking_credit_status else credit_status end,
          provider_booking_id = coalesce(nullif(trim(p_provider_booking_id), ''), provider_booking_id),
          calcom_booking_uid = coalesce(nullif(trim(p_provider_booking_id), ''), calcom_booking_uid),
          provider_status = coalesce(nullif(trim(p_provider_status), ''), provider_status),
          provider_revision = provider_revision + 1,
          provider_last_synced_at = v_occurred_at,
          meeting_url = coalesce(nullif(trim(p_meeting_url), ''), meeting_url),
          reconciliation_reason = null
      where id = v_booking.id returning * into v_booking;
    elsif v_target = 'cancelled' then
      if v_booking.credit_status in ('reserved', 'consumed') then
        perform 1 from public.package_purchases
        where id = v_booking.package_purchase_id for update;
        select exists (
          select 1
          from public.package_purchases pp
          join public.payment_orders po on po.id = pp.payment_order_id
          join public.credit_grants cg on cg.id = pp.credit_grant_id
          where pp.id = v_booking.package_purchase_id
            and pp.payment_status = 'verified'
            and pp.status in ('active', 'completed')
            and po.status = 'paid'
            and (cg.expires_at is null or cg.expires_at > now())
        ) into v_credit_allowed;
        if v_credit_allowed then
          select * into strict v_reservation from public.credit_ledger
          where id = v_booking.credit_reservation_entry_id for update;
          insert into public.credit_ledger (
            credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
            idempotency_key, source_type, source_id, source_action,
            reverses_entry_id, provider_event_id, note
          ) values (
            v_reservation.credit_account_id, v_reservation.credit_grant_id, v_booking.id,
            case when v_booking.credit_status = 'reserved'
                 then 'release'::public.credit_entry_kind
                 else 'cancellation_restore'::public.credit_entry_kind end,
            1, 'booking:' || v_booking.id::text || ':cancel-restore',
            'booking', v_booking.id::text, 'cancel_restore', v_reservation.id,
            v_event.id, 'Provider cancellation restored eligible credit'
          ) on conflict do nothing;
          get diagnostics v_inserted_credit = row_count;
          if v_inserted_credit > 0 and v_booking.credit_status = 'consumed' then
            update public.package_purchases
            set used_sessions = used_sessions - 1,
                remaining_sessions = remaining_sessions + 1,
                status = 'active', completed_at = null
            where id = v_booking.package_purchase_id and used_sessions > 0;
            if not found then raise exception 'CREDIT_PROJECTION_RESTORE_FAILED'; end if;
          end if;
        end if;
      end if;
      update public.bookings
      set lifecycle_status = 'cancelled', sync_status = 'in_sync',
          credit_status = case
            when credit_status in ('reserved', 'consumed') and v_credit_allowed
              then 'restored'::public.booking_credit_status
            when credit_status in ('reserved', 'consumed')
              then 'released'::public.booking_credit_status
            else credit_status end,
          provider_status = coalesce(nullif(trim(p_provider_status), ''), 'cancelled'),
          provider_revision = provider_revision + 1,
          provider_last_synced_at = v_occurred_at, reconciliation_reason = null
      where id = v_booking.id returning * into v_booking;
    else
      if v_target = 'failed' and v_booking.credit_status = 'reserved' then
        perform 1 from public.package_purchases
        where id = v_booking.package_purchase_id for update;
        select exists (
          select 1
          from public.package_purchases pp
          join public.payment_orders po on po.id = pp.payment_order_id
          join public.credit_grants cg on cg.id = pp.credit_grant_id
          where pp.id = v_booking.package_purchase_id
            and pp.payment_status = 'verified' and pp.status = 'active'
            and po.status = 'paid'
            and (cg.expires_at is null or cg.expires_at > now())
        ) into v_credit_allowed;
        if v_credit_allowed then
          select * into strict v_reservation from public.credit_ledger
          where id = v_booking.credit_reservation_entry_id for update;
          insert into public.credit_ledger (
            credit_account_id, credit_grant_id, booking_id, entry_kind, delta,
            idempotency_key, source_type, source_id, source_action,
            reverses_entry_id, provider_event_id, note
          ) values (
            v_reservation.credit_account_id, v_reservation.credit_grant_id, v_booking.id,
            'release', 1, 'booking:' || v_booking.id::text || ':release',
            'booking', v_booking.id::text, 'release', v_reservation.id,
            v_event.id, 'Provider failure released an eligible reservation'
          ) on conflict do nothing;
        end if;
      end if;
      update public.bookings
      set lifecycle_status = v_target,
          sync_status = case
            when v_target = 'failed' then 'failed'::public.booking_sync_status
            when v_target in ('provider_pending', 'cancellation_pending', 'reschedule_pending')
              then 'needs_reconciliation'::public.booking_sync_status
            else 'in_sync'::public.booking_sync_status end,
          credit_status = case
            when v_target = 'failed' and credit_status = 'reserved'
              then 'released'::public.booking_credit_status
            else credit_status end,
          provider_status = coalesce(nullif(trim(p_provider_status), ''), provider_status),
          provider_revision = provider_revision + 1,
          provider_last_synced_at = v_occurred_at,
          reconciliation_reason = case
            when v_external_cancellation_staged
              then 'EXTERNAL_CANCELLATION_EVENT:' || v_event.id::text
            when v_target = 'cancellation_pending'
                 and v_live_operation.id is null
                 and v_booking.reconciliation_reason ~
                   '^EXTERNAL_CANCELLATION_EVENT:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then v_booking.reconciliation_reason
            when v_target in ('provider_pending', 'cancellation_pending', 'reschedule_pending')
              then 'PROVIDER_OPERATION_UNRESOLVED'
            else reconciliation_reason end
      where id = v_booking.id returning * into v_booking;
    end if;

    -- Repeated authoritative observations that show the provider never applied
    -- a cancel or reschedule eventually close a stranded local operation. Hourly
    -- synthetic event IDs ensure these are distinct, stable observations.
    if v_live_operation.id is not null
       and p_event_type = 'RECONCILIATION_SNAPSHOT'
       and (
         (v_live_operation.operation_type = 'cancel' and v_target = 'cancellation_pending')
         or
         (v_live_operation.operation_type = 'reschedule' and v_target = 'reschedule_pending')
       ) then
      v_unchanged_check_count := case
        when v_live_operation.last_error_code = 'PROVIDER_STATE_UNCHANGED'
          then v_live_operation.provider_unchanged_check_count
        else 0
      end;
      if v_live_operation.last_error_code is distinct from 'PROVIDER_STATE_UNCHANGED'
         or v_live_operation.provider_unchanged_last_checked_at is null
         or v_occurred_at >=
           v_live_operation.provider_unchanged_last_checked_at + interval '1 hour' then
        v_unchanged_check_count := v_unchanged_check_count + 1;
      end if;

      if v_live_operation.created_at <= v_occurred_at - interval '2 hours'
         and v_unchanged_check_count >= 2 then
        update public.booking_operations
        set status = 'failed',
            provider_booking_id_after = v_booking.provider_booking_id,
            provider_response = p_payload || jsonb_build_object(
              '_msm_target_lifecycle', v_target,
              '_msm_resolution', 'provider_state_unchanged'
            ),
            attempt_count = attempt_count + 1,
            provider_unchanged_check_count = v_unchanged_check_count,
            provider_unchanged_last_checked_at = v_occurred_at,
            started_at = coalesce(started_at, now()), completed_at = now(),
            next_attempt_at = null,
            last_error_code = 'PROVIDER_STATE_UNCHANGED',
            last_error_detail = 'Repeated provider snapshots did not show the requested mutation'
        where id = v_live_operation.id
        returning * into v_live_operation;

        update public.bookings
        set lifecycle_status = coalesce(
              v_live_operation.previous_lifecycle_status,
              'scheduled'::public.booking_lifecycle_status
            ),
            sync_status = 'in_sync',
            reconciliation_reason = null
        where id = v_booking.id
        returning * into v_booking;

        insert into public.booking_audit_log (
          booking_id, operation_id, provider_event_id, action, actor_kind, after_state
        ) values (
          v_booking.id, v_live_operation.id, v_event.id,
          'operation_failed_after_stable_provider_state', 'system',
          jsonb_build_object(
            'lifecycle_status', v_booking.lifecycle_status,
            'sync_status', v_booking.sync_status,
            'provider_booking_id', v_booking.provider_booking_id,
            'error_code', 'PROVIDER_STATE_UNCHANGED'
          )
        );
      else
        update public.booking_operations
        set attempt_count = attempt_count + 1,
            provider_unchanged_check_count = v_unchanged_check_count,
            provider_unchanged_last_checked_at = case
              when v_unchanged_check_count > provider_unchanged_check_count
                then v_occurred_at
              else provider_unchanged_last_checked_at
            end,
            started_at = coalesce(started_at, now()),
            next_attempt_at = now() + interval '1 hour',
            last_error_code = 'PROVIDER_STATE_UNCHANGED',
            last_error_detail = 'Awaiting another authoritative provider snapshot'
        where id = v_live_operation.id
        returning * into v_live_operation;
      end if;
    end if;

    -- A provider fact also closes the one matching live operation. This is what
    -- lets webhook/cron reconciliation unblock the partial unique live-op guard.
    if v_live_operation.id is not null and not v_live_operation_superseded then
      if (v_live_operation.operation_type in ('create', 'reschedule')
            and v_target in ('scheduled', 'pending_confirmation', 'completed'))
         or (v_live_operation.operation_type = 'cancel' and v_target = 'cancelled')
         or v_live_operation.operation_type = 'reconcile' then
        update public.booking_operations
        set status = 'succeeded',
            provider_booking_id_after = v_booking.provider_booking_id,
            provider_response = p_payload || jsonb_build_object('_msm_target_lifecycle', v_target),
            attempt_count = attempt_count + 1,
            started_at = coalesce(started_at, now()), completed_at = now(),
            last_error_code = null, last_error_detail = null
        where id = v_live_operation.id
        returning * into v_live_operation;
      elsif (v_live_operation.operation_type = 'create' and v_target in ('cancelled', 'failed'))
         or (v_live_operation.operation_type = 'cancel' and v_target = 'completed')
         or (v_live_operation.operation_type = 'reschedule'
             and v_target in ('cancelled', 'failed')) then
        update public.booking_operations
        set status = 'failed',
            provider_booking_id_after = v_booking.provider_booking_id,
            provider_response = p_payload || jsonb_build_object('_msm_target_lifecycle', v_target),
            attempt_count = attempt_count + 1,
            started_at = coalesce(started_at, now()), completed_at = now(),
            last_error_code = 'PROVIDER_EVENT_PROVED_OPERATION_FAILED',
            last_error_detail = left(p_event_type, 2000)
        where id = v_live_operation.id
        returning * into v_live_operation;
      end if;
    end if;

    if v_live_operation.id is not null
       and v_live_operation.operation_type = 'reschedule'
       and v_live_operation.status in ('succeeded', 'failed') then
      update public.booking_slot_claims
      set released_at = now(),
          release_reason = case v_live_operation.status
            when 'succeeded' then 'RESCHEDULE_RECONCILED'
            else 'RESCHEDULE_FAILED_RECONCILED'
          end
      where operation_id = v_live_operation.id
        and claim_kind = 'reschedule_hold'
        and released_at is null;
      if not found then raise exception 'BOOKING_SLOT_HOLD_MISSING'; end if;
    end if;

    update public.provider_events
    set status = 'processed', processed_at = now(), last_error = null
    where id = v_event.id;
    insert into public.booking_audit_log (
      booking_id, operation_id, provider_event_id, action, actor_kind, after_state
    ) values (
      v_booking.id, v_live_operation.id, v_event.id, 'provider_event_applied', 'provider',
      jsonb_build_object(
        'event_type', p_event_type,
        'lifecycle_status', v_booking.lifecycle_status,
        'sync_status', v_booking.sync_status,
        'credit_status', v_booking.credit_status,
        'provider_booking_id', v_booking.provider_booking_id
      )
    );
    return jsonb_build_object(
      'provider_event_id', v_event.id, 'booking_id', v_booking.id,
      'event_status', 'processed', 'lifecycle_status', v_booking.lifecycle_status,
      'sync_status', v_booking.sync_status, 'credit_status', v_booking.credit_status,
      'replayed', false
    );
  exception when others then
    v_error := sqlerrm;
    update public.provider_events
    set status = 'failed', processed_at = null, last_error = left(v_error, 2000)
    where id = v_event.id;
    return jsonb_build_object(
      'provider_event_id', v_event.id, 'booking_id', v_booking.id,
      'event_status', 'failed', 'error', v_error, 'replayed', false
    );
  end;
end
$$;

-- A mutation source UID that disappeared, or remains cancelled without a
-- lineage-linked replacement, is not a one-shot proof of logical cancellation.
-- The same applies when a signed external cancellation staged the booking but
-- Cal.com subsequently returns a complete 404. Two complete observations at
-- least an hour apart close that eventual-consistency window. Evidence for the
-- latter is append-only and tied to the exact provider event that staged the
-- cancellation. The resulting synthetic provider fact then uses the same
-- cancellation and credit-accounting path as a normal reconciliation snapshot.
create or replace function public.record_provider_mutation_terminal_evidence(
  p_booking_id uuid,
  p_expected_provider_booking_id text,
  p_evidence_kind text,
  p_checked_at timestamptz,
  p_expected_operation_started_at timestamptz default null,
  p_staged_resolution_target public.booking_lifecycle_status default null,
  p_provider_starts_at timestamptz default null,
  p_provider_ends_at timestamptz default null,
  p_provider_status text default null,
  p_meeting_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_operation public.booking_operations%rowtype;
  v_staged_event public.provider_events%rowtype;
  v_staged_event_id uuid;
  v_checked_at timestamptz := coalesce(p_checked_at, now());
  v_error_code text;
  v_check_count integer;
  v_previous_evidence_kind text;
  v_previous_evidence_fingerprint text;
  v_previous_check_count integer;
  v_previous_checked_at timestamptz;
  v_evidence_fingerprint text;
  v_normalized_provider_status text;
  v_resolution_target public.booking_lifecycle_status;
  v_anchor text;
  v_result jsonb;
begin
  if p_evidence_kind not in (
       'source_absent', 'source_cancelled', 'source_active', 'source_pending'
     )
     or nullif(trim(p_expected_provider_booking_id), '') is null
     or v_checked_at > now() + interval '5 minutes' then
    raise exception 'INVALID_MUTATION_TERMINAL_EVIDENCE';
  end if;
  v_error_code := case p_evidence_kind
    when 'source_absent' then 'PROVIDER_MUTATION_SOURCE_ABSENT'
    when 'source_cancelled' then 'PROVIDER_MUTATION_SOURCE_CANCELLED'
    when 'source_active' then 'PROVIDER_MUTATION_SOURCE_ACTIVE'
    else 'PROVIDER_MUTATION_SOURCE_PENDING'
  end;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.provider_booking_id is distinct from p_expected_provider_booking_id
     or v_booking.lifecycle_status not in ('cancellation_pending', 'reschedule_pending') then
    return jsonb_build_object(
      'resolved', false, 'negative_checks', 0,
      'reason', 'BOOKING_PROVIDER_STATE_CHANGED_DURING_LOOKUP'
    );
  end if;

  select * into v_operation
  from public.booking_operations
  where booking_id = v_booking.id
    and operation_type in ('cancel', 'reschedule')
    and status in ('queued', 'processing', 'ambiguous')
  order by created_at
  limit 1
  for update;
  if found then
    if p_evidence_kind not in ('source_absent', 'source_cancelled') then
      return jsonb_build_object(
        'resolved', false,
        'negative_checks', v_operation.provider_unchanged_check_count,
        'reason', 'PRESENCE_EVIDENCE_NOT_VALID_FOR_LOCAL_MUTATION'
      );
    end if;
    if v_operation.provider_booking_id_before is distinct from p_expected_provider_booking_id
       or v_operation.started_at is distinct from p_expected_operation_started_at then
      return jsonb_build_object(
        'resolved', false,
        'negative_checks', v_operation.provider_unchanged_check_count,
        'reason', 'PROVIDER_MUTATION_CHANGED_DURING_LOOKUP'
      );
    end if;

    if v_operation.last_error_code = v_error_code
       and v_operation.provider_unchanged_last_checked_at is not null
       and v_checked_at < v_operation.provider_unchanged_last_checked_at + interval '1 hour' then
      return jsonb_build_object(
        'resolved', false,
        'negative_checks', v_operation.provider_unchanged_check_count,
        'reason', 'TERMINAL_EVIDENCE_TOO_SOON'
      );
    end if;

    v_check_count := case
      when v_operation.last_error_code = v_error_code
        then v_operation.provider_unchanged_check_count + 1
      else 1
    end;
    update public.booking_operations
    set provider_unchanged_check_count = v_check_count,
        provider_unchanged_last_checked_at = v_checked_at,
        next_attempt_at = v_checked_at + interval '1 hour',
        last_error_code = v_error_code,
        last_error_detail = 'Awaiting repeated complete terminal provider evidence'
    where id = v_operation.id;

    if v_check_count >= 2
       and coalesce(v_operation.started_at, v_operation.created_at) <=
         v_checked_at - interval '2 hours' then
      v_result := public.process_provider_booking_event(
        'calcom',
        'reconcile:mutation-terminal:' || v_operation.id::text || ':' ||
          p_evidence_kind || ':' || v_check_count::text,
        'RECONCILIATION_SNAPSHOT',
        v_booking.id,
        p_expected_provider_booking_id,
        v_checked_at,
        'cancelled',
        v_booking.starts_at,
        v_booking.ends_at,
        'cancelled',
        null,
        jsonb_build_object(
          'schemaVersion', 1,
          'source', 'cron_reconciliation',
          'bookingId', v_booking.id,
          'providerBookingId', p_expected_provider_booking_id,
          'mutationTerminalEvidence', true,
          'evidenceKind', p_evidence_kind,
          'negativeChecks', v_check_count
        ),
        null
      );
      return jsonb_build_object(
        'resolved', coalesce(v_result ->> 'event_status', '') = 'processed',
        'negative_checks', v_check_count,
        'provider_event', v_result
      );
    end if;

    return jsonb_build_object(
      'resolved', false,
      'negative_checks', v_check_count,
      'reason', 'MORE_TERMINAL_EVIDENCE_REQUIRED'
    );
  end if;

  -- There is intentionally no synthetic operation for a provider-originated
  -- cancellation. Its durable anchor is the exact signed provider event that
  -- changed the booking to cancellation_pending.
  if v_booking.lifecycle_status <> 'cancellation_pending'
     or p_evidence_kind not in ('source_absent', 'source_active', 'source_pending')
     or p_expected_operation_started_at is not null
     or v_booking.reconciliation_reason !~
       '^EXTERNAL_CANCELLATION_EVENT:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object(
      'resolved', false, 'negative_checks', 0,
      'reason', 'NO_LIVE_MUTATION_OR_STAGED_CANCELLATION'
    );
  end if;

  v_anchor := substring(
    v_booking.reconciliation_reason
    from '^EXTERNAL_CANCELLATION_EVENT:([0-9a-f-]{36})$'
  );
  begin
    v_staged_event_id := v_anchor::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object(
      'resolved', false, 'negative_checks', 0,
      'reason', 'STAGED_CANCELLATION_ANCHOR_INVALID'
    );
  end;

  select * into v_staged_event
  from public.provider_events
  where id = v_staged_event_id
  for update;
  if not found
     or v_staged_event.provider <> 'calcom'
     or v_staged_event.booking_id is distinct from v_booking.id
     or v_staged_event.provider_booking_id is distinct from p_expected_provider_booking_id
     or v_staged_event.status <> 'processed'
     or v_staged_event.processed_at is null
     or lower(v_staged_event.event_type) not similar to '%(cancel|cancelled|canceled)%'
     or not exists (
       select 1
       from public.booking_audit_log bal
       where bal.booking_id = v_booking.id
         and bal.provider_event_id = v_staged_event.id
         and bal.action = 'provider_event_applied'
         and bal.after_state ->> 'lifecycle_status' = 'cancellation_pending'
     ) then
    return jsonb_build_object(
      'resolved', false, 'negative_checks', 0,
      'reason', 'STAGED_CANCELLATION_ANCHOR_MISMATCH'
    );
  end if;

  v_normalized_provider_status := regexp_replace(
    lower(trim(coalesce(p_provider_status, ''))),
    '[[:space:]-]+', '_', 'g'
  );
  v_resolution_target := case p_evidence_kind
    when 'source_absent' then 'cancelled'::public.booking_lifecycle_status
    when 'source_active' then 'scheduled'::public.booking_lifecycle_status
    else 'pending_confirmation'::public.booking_lifecycle_status
  end;
  if p_staged_resolution_target is distinct from (
       case p_evidence_kind
         when 'source_absent' then null::public.booking_lifecycle_status
         else v_resolution_target
       end
     )
     or (
       p_evidence_kind = 'source_absent'
       and (
         p_provider_starts_at is not null
         or p_provider_ends_at is not null
         or p_provider_status is not null
         or p_meeting_url is not null
       )
     )
     or (
       p_evidence_kind = 'source_active'
       and (
         v_normalized_provider_status not in ('accepted', 'confirmed', 'scheduled', 'booked')
         or p_provider_starts_at is null
         or p_provider_ends_at is null
       )
     )
     or (
       p_evidence_kind = 'source_pending'
       and v_normalized_provider_status not in (
         'pending', 'pending_confirmation', 'requested', 'unconfirmed', 'awaiting_host'
       )
     )
     or (p_provider_starts_at is null) <> (p_provider_ends_at is null)
     or (
       p_provider_starts_at is not null
       and p_provider_ends_at <>
         p_provider_starts_at + (v_booking.duration_minutes * interval '1 minute')
     ) then
    return jsonb_build_object(
      'resolved', false, 'negative_checks', 0,
      'reason', 'STAGED_CANCELLATION_EVIDENCE_INVALID'
    );
  end if;

  v_evidence_fingerprint := encode(digest(
    concat_ws(
      '|',
      p_evidence_kind,
      v_resolution_target::text,
      coalesce(p_provider_starts_at::text, ''),
      coalesce(p_provider_ends_at::text, ''),
      v_normalized_provider_status
    ),
    'sha256'
  ), 'hex');

  select
    bal.after_state ->> 'evidence_kind',
    bal.after_state ->> 'evidence_fingerprint',
    (bal.after_state ->> 'negative_checks')::integer,
    (bal.after_state ->> 'checked_at')::timestamptz
  into v_previous_evidence_kind, v_previous_evidence_fingerprint,
       v_previous_check_count, v_previous_checked_at
  from public.booking_audit_log bal
  where bal.booking_id = v_booking.id
    and bal.provider_event_id = v_staged_event.id
    and bal.action = 'external_cancellation_terminal_evidence'
  order by bal.id desc
  limit 1;

  if v_checked_at < v_staged_event.processed_at
     or (
       v_previous_evidence_kind = p_evidence_kind
       and v_previous_evidence_fingerprint = v_evidence_fingerprint
       and v_previous_checked_at is not null
       and v_checked_at < v_previous_checked_at + interval '1 hour'
     ) then
    return jsonb_build_object(
      'resolved', false,
      'negative_checks', coalesce(v_previous_check_count, 0),
      'reason', 'TERMINAL_EVIDENCE_TOO_SOON'
    );
  end if;

  v_check_count := case
    when v_previous_evidence_kind = p_evidence_kind
         and v_previous_evidence_fingerprint = v_evidence_fingerprint
      then coalesce(v_previous_check_count, 0) + 1
    else 1
  end;
  insert into public.booking_audit_log (
    booking_id, provider_event_id, action, actor_kind, after_state
  ) values (
    v_booking.id, v_staged_event.id,
    'external_cancellation_terminal_evidence', 'system',
    jsonb_build_object(
      'provider_booking_id', p_expected_provider_booking_id,
      'evidence_kind', p_evidence_kind,
      'evidence_fingerprint', v_evidence_fingerprint,
      'resolution_target', v_resolution_target,
      'negative_checks', v_check_count,
      'checked_at', v_checked_at
    )
  );

  if v_check_count >= 2
     and v_staged_event.processed_at <= v_checked_at - interval '2 hours' then
    v_result := public.process_provider_booking_event(
      'calcom',
      'reconcile:external-cancellation-terminal:' || v_staged_event.id::text || ':' ||
        p_evidence_kind || ':' || left(v_evidence_fingerprint, 16) || ':' ||
        v_check_count::text,
      'RECONCILIATION_SNAPSHOT',
      v_booking.id,
      p_expected_provider_booking_id,
      v_checked_at,
      v_resolution_target,
      coalesce(p_provider_starts_at, v_booking.starts_at),
      coalesce(p_provider_ends_at, v_booking.ends_at),
      case when p_evidence_kind = 'source_absent'
        then 'cancelled' else p_provider_status end,
      p_meeting_url,
      jsonb_build_object(
        'schemaVersion', 1,
        'source', 'cron_reconciliation',
        'bookingId', v_booking.id,
        'providerBookingId', p_expected_provider_booking_id,
        'mutationTerminalEvidence', true,
        'stagedProviderEventId', v_staged_event.id,
        'evidenceKind', p_evidence_kind,
        'evidenceFingerprint', v_evidence_fingerprint,
        'resolutionTarget', v_resolution_target,
        'negativeChecks', v_check_count
      ),
      null
    );
    return jsonb_build_object(
      'resolved', coalesce(v_result ->> 'event_status', '') = 'processed',
      'negative_checks', v_check_count,
      'staged_provider_event_id', v_staged_event.id,
      'provider_event', v_result
    );
  end if;

  return jsonb_build_object(
    'resolved', false,
    'negative_checks', v_check_count,
    'staged_provider_event_id', v_staged_event.id,
    'reason', 'MORE_TERMINAL_EVIDENCE_REQUIRED'
  );
end
$$;

create or replace function public.mark_stripe_event_failed(
  p_event_id text,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stripe_events
  set status = 'failed', attempt_count = attempt_count + 1,
      last_error = left(coalesce(nullif(trim(p_error), ''), 'UNSPECIFIED_PROCESSING_ERROR'), 2000)
  where event_id = p_event_id and status not in ('processed', 'ignored');
  return found;
end
$$;

create or replace function public.ignore_stripe_event(
  p_event_id text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_events%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || p_event_id, 0));
  select * into v_event
  from public.stripe_events
  where event_id = p_event_id
  for update;
  if not found then raise exception 'STRIPE_EVENT_NOT_INGESTED'; end if;

  if v_event.status in ('processed', 'ignored') then
    return false;
  end if;
  if v_event.effect_type is not null then
    raise exception 'STRIPE_EVENT_ALREADY_BOUND';
  end if;

  update public.stripe_events
  set status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1,
      last_error = left(coalesce(nullif(trim(p_reason), ''), 'IGNORED_UNRELATED_EVENT'), 2000)
  where event_id = p_event_id;
  return true;
end
$$;

-- Compatibility adapters keep the pre-ledger server routes safe during a rolling
-- deployment. They use the new journal and operation state machine internally.
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
  v_household_id uuid;
  v_learner_id uuid;
  v_reserved jsonb;
  v_confirmed jsonb;
begin
  select primary_household_id into v_household_id
  from public.profiles where id = p_user_id and deactivated_at is null;
  if v_household_id is null then raise exception 'HOUSEHOLD_NOT_PROVISIONED'; end if;
  select id into v_learner_id
  from public.learners
  where household_id = v_household_id and is_active
  order by is_legacy_placeholder desc, created_at, id
  limit 1;
  if v_learner_id is null then raise exception 'LEARNER_REQUIRED'; end if;

  v_reserved := public.reserve_booking_credit(
    p_user_id, v_household_id, v_learner_id, p_tutor_id, p_package_id,
    p_package_purchase_id, p_subject_id, p_starts_at, 60, p_time_zone,
    p_location, p_location_venue, p_contact_name, p_contact_email,
    p_contact_phone, p_message, 'legacy-api:create:' || p_calcom_booking_uid
  );
  v_confirmed := public.confirm_booking_credit(
    (v_reserved ->> 'booking_id')::uuid,
    (v_reserved ->> 'operation_id')::uuid,
    p_calcom_booking_uid,
    p_calcom_event_type_id,
    p_starts_at,
    p_starts_at + interval '60 minutes',
    'scheduled',
    null,
    jsonb_build_object('compatibility_adapter', true)
  );
  return (v_confirmed ->> 'booking_id')::uuid;
end
$$;

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
  v_operation jsonb;
  v_completed jsonb;
  v_had_credit boolean;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and calcom_booking_uid = p_expected_calcom_uid
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.lifecycle_status = 'cancelled' then return false; end if;
  v_had_credit := v_booking.credit_status in ('reserved', 'consumed');
  v_operation := public.begin_booking_operation(
    v_booking.id,
    v_booking.created_by_user_id,
    'cancel',
    'legacy-api:cancel:' || v_booking.id::text || ':' || p_expected_calcom_uid,
    null, null, 'Compatibility cancellation'
  );
  v_completed := public.complete_booking_operation(
    (v_operation ->> 'operation_id')::uuid,
    p_expected_calcom_uid,
    null, null, 'cancelled', null,
    jsonb_build_object('compatibility_adapter', true)
  );
  return v_had_credit and (v_completed ->> 'credit_status') = 'restored';
end
$$;

-- SECURITY DEFINER entry points are backend-only. No browser role can mint money,
-- impersonate a guardian, or acknowledge an unverified provider event.
revoke all on function public.create_payment_order(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_stripe_checkout_session(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.ingest_stripe_event(text, text, boolean, text, timestamptz, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.fulfill_stripe_checkout(
  text, text, text, integer, integer, integer, text, text, text, integer, integer, text
)
  from public, anon, authenticated;
revoke all on function public.fail_stripe_payment_order(text, text, public.payment_order_status, text, text)
  from public, anon, authenticated;
revoke all on function public.apply_stripe_refund(text, text, text, integer, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.apply_stripe_dispute(text, text, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.reserve_booking_credit(
  uuid, uuid, uuid, uuid, uuid, uuid, text, timestamptz, integer, text,
  text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.confirm_booking_credit(
  uuid, uuid, text, integer, timestamptz, timestamptz, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.release_booking_credit(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.record_missing_provider_create(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_provider_mutation_terminal_evidence(
  uuid, text, text, timestamptz, timestamptz,
  public.booking_lifecycle_status, timestamptz, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.claim_booking_operation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.begin_booking_operation(
  uuid, uuid, public.booking_operation_type, text, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.complete_booking_operation(
  uuid, text, timestamptz, timestamptz, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.fail_booking_operation(uuid, boolean, text, text)
  from public, anon, authenticated;
revoke all on function public.process_provider_booking_event(
  text, text, text, uuid, text, timestamptz, public.booking_lifecycle_status,
  timestamptz, timestamptz, text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.mark_stripe_event_failed(text, text)
  from public, anon, authenticated;
revoke all on function public.ignore_stripe_event(text, text)
  from public, anon, authenticated;
revoke all on function public.finalize_booking_with_credit(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text,
  text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.cancel_booking_and_restore_credit(uuid, text)
  from public, anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.create_payment_order(uuid, uuid, text, text)
  to service_role;
grant execute on function public.attach_stripe_checkout_session(uuid, uuid, text, text)
  to service_role;
grant execute on function public.ingest_stripe_event(text, text, boolean, text, timestamptz, jsonb, text)
  to service_role;
grant execute on function public.fulfill_stripe_checkout(
  text, text, text, integer, integer, integer, text, text, text, integer, integer, text
)
  to service_role;
grant execute on function public.fail_stripe_payment_order(text, text, public.payment_order_status, text, text)
  to service_role;
grant execute on function public.apply_stripe_refund(text, text, text, integer, text, text, text, timestamptz)
  to service_role;
grant execute on function public.apply_stripe_dispute(text, text, text, integer, text, text)
  to service_role;
grant execute on function public.reserve_booking_credit(
  uuid, uuid, uuid, uuid, uuid, uuid, text, timestamptz, integer, text,
  text, text, text, text, text, text, text
) to service_role;
grant execute on function public.confirm_booking_credit(
  uuid, uuid, text, integer, timestamptz, timestamptz, text, text, jsonb
) to service_role;
grant execute on function public.release_booking_credit(uuid, uuid, text, text)
  to service_role;
grant execute on function public.record_missing_provider_create(uuid, timestamptz, timestamptz)
  to service_role;
grant execute on function public.record_provider_mutation_terminal_evidence(
  uuid, text, text, timestamptz, timestamptz,
  public.booking_lifecycle_status, timestamptz, timestamptz, text, text
) to service_role;
grant execute on function public.claim_booking_operation(uuid, uuid)
  to service_role;
grant execute on function public.begin_booking_operation(
  uuid, uuid, public.booking_operation_type, text, timestamptz, text, text
) to service_role;
grant execute on function public.complete_booking_operation(
  uuid, text, timestamptz, timestamptz, text, text, jsonb
) to service_role;
grant execute on function public.fail_booking_operation(uuid, boolean, text, text)
  to service_role;
grant execute on function public.process_provider_booking_event(
  text, text, text, uuid, text, timestamptz, public.booking_lifecycle_status,
  timestamptz, timestamptz, text, text, jsonb, text
) to service_role;
grant execute on function public.mark_stripe_event_failed(text, text)
  to service_role;
grant execute on function public.ignore_stripe_event(text, text)
  to service_role;
grant execute on function public.finalize_booking_with_credit(
  uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text,
  text, text, text, integer
) to service_role;
grant execute on function public.cancel_booking_and_restore_credit(uuid, text)
  to service_role;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

commit;
