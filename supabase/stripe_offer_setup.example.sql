-- Example operator script for publishing Stripe-backed MSM offer versions.
--
-- Preconditions:
--   1. Apply every migration in supabase/migrations first.
--   2. Create the Products and one-time Prices in Stripe.
--   3. Verify each Stripe Price amount/currency/tax behavior against public.packages.
--   4. Replace every value wrapped in <...> below.
--
-- This script never enables checkout. Enabling an active offer is a separate,
-- reviewed production action shown (commented out) at the end of the file.

begin;

select pg_advisory_xact_lock(hashtextextended('msm:publish-stripe-offers', 0));

create temporary table stripe_offer_input (
  package_slug text primary key,
  stripe_product_id text not null,
  stripe_price_id text not null,
  constraint stripe_offer_input_price_unique unique (stripe_price_id)
) on commit drop;

insert into stripe_offer_input (package_slug, stripe_product_id, stripe_price_id)
values
  (
    'single',
    '<REPLACE_WITH_STRIPE_PRODUCT_ID_SINGLE>',
    '<REPLACE_WITH_STRIPE_PRICE_ID_SINGLE>'
  ),
  (
    'small',
    '<REPLACE_WITH_STRIPE_PRODUCT_ID_SMALL>',
    '<REPLACE_WITH_STRIPE_PRICE_ID_SMALL>'
  ),
  (
    'medium',
    '<REPLACE_WITH_STRIPE_PRODUCT_ID_MEDIUM>',
    '<REPLACE_WITH_STRIPE_PRICE_ID_MEDIUM>'
  );

do $publish$
declare
  -- Replace with exactly 'test' or 'live'. This must match STRIPE_SECRET_KEY.
  v_stripe_mode text := '<REPLACE_WITH_test_OR_live>';
  -- Replace with the legally/accounting-approved Stripe Price behavior.
  v_tax_behavior text := 'inclusive';
  v_input record;
  v_package public.packages%rowtype;
  v_next_version integer;
  v_offer_version_id uuid;
begin
  if v_stripe_mode not in ('test', 'live') then
    raise exception 'Replace v_stripe_mode with test or live before running this script';
  end if;
  if v_tax_behavior <> 'inclusive' then
    raise exception 'Public consumer checkout requires tax-inclusive Stripe prices';
  end if;
  if exists (
    select 1
    from stripe_offer_input
    where stripe_product_id !~ '^prod_[A-Za-z0-9_]+$'
       or stripe_price_id !~ '^price_[A-Za-z0-9_]+$'
  ) then
    raise exception 'Replace every Stripe Product and Price placeholder with a provider-created ID';
  end if;

  for v_input in
    select * from stripe_offer_input order by package_slug
  loop
    select * into strict v_package
    from public.packages
    where slug = v_input.package_slug
      and active
      and price_cents > 0;

    select coalesce(max(version), 0) + 1 into v_next_version
    from public.offer_versions
    where package_id = v_package.id;

    insert into public.offer_versions (
      package_id,
      version,
      provider,
      name,
      sessions,
      amount_cents,
      currency,
      stripe_product_id,
      stripe_price_id,
      stripe_livemode,
      tax_behavior,
      effective_from
    ) values (
      v_package.id,
      v_next_version,
      'stripe',
      v_package.name,
      v_package.sessions,
      v_package.price_cents,
      'EUR',
      v_input.stripe_product_id,
      v_input.stripe_price_id,
      v_stripe_mode = 'live',
      v_tax_behavior,
      now()
    )
    returning id into v_offer_version_id;

    insert into public.active_offers (
      package_id,
      offer_version_id,
      checkout_enabled,
      updated_by_user_id
    ) values (
      v_package.id,
      v_offer_version_id,
      false,
      null
    )
    on conflict (package_id) do update
    set offer_version_id = excluded.offer_version_id,
        checkout_enabled = false,
        updated_by_user_id = null;

    raise notice 'Published disabled offer version % for package %',
      v_next_version,
      v_input.package_slug;
  end loop;
end
$publish$;

commit;

-- Review the resulting immutable commercial facts. Compare every row with the
-- corresponding Stripe Price object before enabling checkout.
select
  p.slug,
  ov.version,
  ov.name,
  ov.sessions,
  ov.amount_cents,
  ov.currency,
  ov.stripe_product_id,
  ov.stripe_price_id,
  ov.stripe_livemode,
  ov.tax_behavior,
  ao.checkout_enabled
from public.active_offers ao
join public.offer_versions ov on ov.id = ao.offer_version_id
join public.packages p on p.id = ao.package_id
where p.slug in ('single', 'small', 'medium')
order by p.slug;

-- Run the following as a separate reviewed action only after:
--   * Stripe/webhook testing and duplicate-delivery checks pass;
--   * PAYMENTS_LEGAL_APPROVED and PAYMENTS_ENABLED are approved for this environment;
--   * the Stripe key mode matches offer_versions.stripe_livemode;
--   * tax, invoice, refund, dispute, and cancellation policies are approved.
--
-- begin;
-- update public.active_offers ao
-- set checkout_enabled = true,
--     updated_by_user_id = null
-- from public.offer_versions ov, public.packages p
-- where ao.offer_version_id = ov.id
--   and ao.package_id = p.id
--   and ov.provider = 'stripe'
--   and p.slug in ('single', 'small', 'medium');
-- commit;
