# Database migrations

Apply every file in `supabase/migrations` in filename order. Do not deploy the application revision that depends on a migration until that migration and its backfill checks have succeeded.

Current order:

1. `20260721000100_backend_foundation.sql` creates the canonical tutor, package, profile, purchase, and booking foundation and seeds the stable catalog rows.
2. `20260721000200_msm_households_payments_ledger.sql` adds household RBAC, learners, additive account roles, immutable offers, Stripe orders/inboxes, append-only credit accounting, local-first booking operations, provider reconciliation, and stricter constraints.
3. `20260722000100_supabase_booking_chat.sql` replaces the external messaging store with append-only booking messages, private Realtime topic authorization, and minimized database broadcasts.

All migrations are transactional. A validation exception rolls back that migration; investigate the named invariant instead of bypassing it or editing an already-applied migration.

## Before an existing-database migration

1. Take a restorable database backup and record the migration version and row counts.
2. Restore a production-like copy into staging and run the migrations there first.
3. Inventory existing profiles, tutor mappings, purchases, bookings, payment references, duplicate/overlapping tutor appointments, and rows whose provider identity is uncertain.
4. Keep `PAYMENTS_ENABLED=false`, `PAYMENTS_LEGAL_APPROVED=false`, and every `active_offers.checkout_enabled=false`. Database migration is not authorization to sell.
5. Stop writes or use a reviewed maintenance window for the production migration and reconciliation.

The foundation migration does not heuristically convert incompatible hand-written tables. When detected, it renames them to `tutors_legacy_20260721`, `bookings_legacy_20260721`, and `package_purchases_legacy_20260721`, revokes browser access, and creates the canonical schema alongside them. Export and reconcile those preserved rows against canonical UUIDs and provider/payment evidence before a later reviewed import. Do not drop the legacy tables in the same migration run.

## Household/payment backfill behavior

The second migration deliberately makes uncertainty visible:

- It creates one household and owner membership for each existing customer-like account, assigns `profiles.primary_household_id`, and backfills the existing profile role into `account_roles`.
- Tutors without historic customer activity remain household-less; the migration does not invent a family relationship.
- It creates one active `Legacy learner - assignment required` placeholder for each backfilled household with canonical bookings and attaches those bookings to it. It never guesses which child attended a historic lesson.
- It snapshots existing logical packages into version-1 `legacy_manual` offers and creates disabled `active_offers` pointers.
- A legacy purchase marked verified with a blank/whitespace payment reference is downgraded to unverified before any credit is granted. Non-empty verified references are preserved as evidence requiring operator review.
- It creates linked legacy payment orders, grants, and ledger entries only from the canonical purchase rows. The old `remaining_sessions` projection is preserved with an explicit adjustment entry when historic consumption cannot be tied to a booking.
- It gives existing bookings deterministic migration idempotency keys, local lifecycle/sync state, provider identity, audit entries, and the household placeholder learner.

The migration refuses to finish if any canonical purchase lacks a household/offer/order link, any booking lacks required household/learner/lifecycle data, or live historic tutor appointments overlap. Resolve those rows explicitly in staging, document the decision, and rerun from the rolled-back state.

## Post-migration audit

Before deploying application code, verify at minimum:

- the five canonical tutors and four logical packages match `src/domain/catalog.ts`;
- every active user has the intended unrevoked `account_roles` entries, and every tutor role maps to exactly one tutor;
- every customer household has the intended active membership permissions;
- every `Legacy learner - assignment required` row has an assigned reviewer and is corrected through the learner workflow before learner-level reporting is trusted;
- no payment was made verified merely to make a balance appear;
- `credit_accounts.available_balance` equals the sum of its append-only ledger entries, and verified legacy purchase projections reconcile to their grants;
- bookings have the expected learner, provider UID, lifecycle/sync state, and no prohibited tutor overlap;
- booking messages are service-write-only, immutable, scoped to a live booking, and private Realtime topics reject unrelated or insufficiently authenticated users;
- RLS/browser grants expose only the intended household/read models while provider inboxes, payment internals, contact data, mutations, and ledger internals remain service-role concerns.

Retain a reconciliation artifact containing the before/after counts, ambiguous rows, evidence used, adjustments approved, and operator/reviewer identities.

## Booking chat

`booking_messages` is the durable history source. Authenticated browser roles have no table-write permission; Vercel Functions re-authorize the booking and insert with the Supabase service role. `(sender_user_id, client_message_id)` is unique, so a safe retry returns the original row only when its booking, side, and body match. Update and delete triggers keep the history append-only until a separately reviewed retention or redaction workflow exists.

The insert trigger sends a private `message_created` event through `realtime.send`. Its payload excludes the booking ID and internal user ID; the booking UUID is used only as the private topic. `booking_chat_broadcast_receive` calls `can_receive_booking_chat_topic` when a client joins and mirrors the live household, tutor, profile, lifecycle, and AAL2 authorization rules. Disable public channel access in Supabase Realtime Settings before testing chat.

## Immutable Stripe offers

`offer_versions` is the commercial source of truth for a sale. Database triggers reject updates and deletes. A change to name, lesson quantity, amount, currency, Stripe Product/Price mapping, live/test mode, tax behavior, or effective window requires a new row. `active_offers` is only the mutable pointer and per-package new-sales switch.

After creating real Products and one-time Prices in Stripe:

1. Copy and review `supabase/stripe_offer_setup.example.sql`.
2. Replace every placeholder with provider-created IDs, the correct test/live mode, and the approved tax behavior.
3. Run the script through a trusted operator connection. It publishes a new version, moves each pointer, and leaves checkout disabled.
4. Compare every stored fact with the corresponding Stripe object and approved public display.
5. Enable only the reviewed pointer after webhook, fulfillment, refund/dispute, tax, and legal tests pass.

Never put Stripe Price IDs in browser code or environment variables, fabricate provider IDs, update an `offer_versions` row, or repoint an offer without retaining the review evidence.

## Payment and credit authority

Checkout creates a EUR-only `payment_orders` snapshot from the enabled immutable offer. Before every fresh provider Session, the server rechecks the current sales pointer and retrieves the active Stripe Price/Product to match fixed amount, currency, tax behavior, mode, and immutable IDs. A replayed attached Session is also re-read and matched to that exact order before its URL is returned. The browser redirect never writes entitlement. Only signature-verified Stripe webhook fulfillment can create a verified `package_purchases` row, its `credit_grants` row, and the corresponding append-only grant entry after re-reading Stripe and matching the order's mode, Price, amount, currency, paid status, and quantity. Signed Stripe events for unrelated objects are retained as terminally ignored inbox records, while a genuine event racing local attachment stays retryable.

The two environment flags and `active_offers.checkout_enabled` gate new orders and fresh unattached Checkout Sessions. An already attached open Session is deliberately replayable because its URL may already be with the customer. The Stripe webhook/RPC path does not consult new-sales gates and must stay deployed and configured while any Checkout, refund, dispute, or provider retry may still arrive.

Credits belong to the household credit account. Paid booking input contains a stable package ID, not a purchase/grant ID. `reserve_booking_credit` locks and chooses the eligible grant with the earliest expiry, then oldest creation time, and reserves it in the ledger before the Cal.com call. That immutable reservation remains the confirmation authority even if unreserved value expires, is refunded, or is disputed during the provider call, preventing a real Cal.com booking from being stranded. Deterministic failure releases it; ambiguous provider state remains pending for signed-webhook, scheduled-job, or explicit operator reconciliation. UID-less creates are recovered only by a unique exact internal-ID provider match around the atomically recorded provider-attempt time; release requires two complete negative searches after a 24-hour safety window from that attempt. Mutation 404/cancelled-source evidence is lineage-checked and separately requires two complete spaced observations before terminal settlement.

Do not mutate grants or ledger history to repair a balance. Use a reviewed, idempotent adjustment/revocation workflow that preserves the evidence trail.

## Release sequence

Use this release order:

1. Back up and rehearse all migrations plus legacy reconciliation in staging.
2. Apply migrations to staging in filename order with all sales controls off, then complete the household, role, learner, payment, credit, booking, RLS, and MFA audit.
3. Deploy the application to staging with test Stripe/Cal.com webhook secrets and `CRON_SECRET`; register both signed callbacks and the authenticated reconciliation schedule. Disable Supabase Realtime public access and verify private booking-topic authorization. The checked-in Hobby schedule runs daily; use Vercel Pro or an equivalent scheduler when the reviewed production SLO requires hourly repair.
4. Publish disabled test-mode Stripe offers, compare them with Stripe, then test successful/async/failed/expired Checkout, duplicate events, refunds/disputes, booking reservation/confirmation/release, webhook replay/order, reconciliation, and chat isolation/idempotency.
5. Take a fresh production backup, apply the same migrations during a reviewed write window, and complete the backfill audit before deploying dependent application code.
6. Deploy production with live signed callbacks and an authenticated reconciliation schedule that meets the reviewed operational SLO while all new-sales controls remain off. Publish and verify the live offer versions with their pointers still disabled.
7. Record legal/tax/refund approval, set `PAYMENTS_LEGAL_APPROVED=true`, set the operational `PAYMENTS_ENABLED=true`, and enable only the reviewed live offer pointers.

To stop sales, disable the relevant offer pointer and/or an environment new-sales gate. Do not remove the Stripe webhook secret or take the webhook route offline; fulfillment and financial reconciliation remain active independently of those switches.
