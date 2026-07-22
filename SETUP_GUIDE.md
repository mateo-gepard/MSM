# MSM setup and release guide

The application uses Supabase for identity and persistence, Stripe Checkout for one-time package payments, Cal.com v2 for scheduling, and Sendbird for household–tutor chat. Household permissions, payment facts, credit accounting, and booking lifecycle state remain authoritative in MSM. Provider callbacks are signature-verified inputs, not authorization decisions.

There is no mock-success fallback. New sales are fail-closed until both payment activation flags are explicitly enabled, a Stripe-backed immutable offer is published, and its checkout pointer is enabled. Signed Stripe webhook fulfillment and financial reconciliation stay active independently of those new-sales controls.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Keep `.env.local` and all provider secrets out of source control.

## Environment contract

Copy the names from `.env.example` and replace every placeholder:

- `NEXT_PUBLIC_SITE_URL`: canonical application origin. Production must use HTTPS; provide an origin such as `https://example.com`, without credentials or an application path.
- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key.
- `RATE_LIMIT_SECRET`: at least 32 random characters used to HMAC identities for the database-backed API limiter. Use a different value per environment.
- `PAYMENTS_ENABLED`: operational new-Checkout gate. It defaults to `false`.
- `PAYMENTS_LEGAL_APPROVED`: independent legal/commercial new-Checkout gate. It defaults to `false`.
- `STRIPE_AUTOMATIC_TAX_ENABLED`: enables Stripe automatic tax calculation in Checkout only after tax configuration and review. It defaults to `false`.
- `STRIPE_SECRET_KEY`: server-only Stripe key for the same test/live mode as the published offer versions.
- `STRIPE_WEBHOOK_SECRET`: signing secret for this deployment's Stripe webhook endpoint, not a CLI secret reused in production.
- `CALCOM_API_KEY`: server-only Cal.com API key.
- `CALCOM_EVENT_TYPE_IDS_JSON`: JSON object mapping every canonical tutor slug to a Cal.com event-type ID.
- `CALCOM_DEFAULT_EVENT_TYPE_ID`: optional fallback only when every tutor deliberately shares one event type.
- `CALCOM_WEBHOOK_SECRET`: secret configured on the Cal.com webhook subscription. Production requires at least 32 UTF-8 bytes and rejects template placeholders.
- `SENDBIRD_APP_ID`: server-only Sendbird application ID used to address the Platform API. It is never returned to browsers.
- `SENDBIRD_API_TOKEN`: server-only Sendbird Platform API token.
- `SENDBIRD_CHANNEL_CONTRACT_SECRET`: at least 32 random characters, unique per environment and stable for the lifetime of its deterministic channels. It seals the creation-time channel contract and must never be sent to browsers. Rotation requires controlled channel recreation and retained-history migration.
- `SENDBIRD_TOKEN_AUTH_REQUIRED`: operator attestation for Sendbird's provider-side token gate. Keep `false` until the Dashboard is verified, then set exactly `true`; chat fails closed otherwise.
- `SENDBIRD_RESTRICTED_ACL_REQUIRED`: operator attestation that Sendbird SDK discovery, metadata, and channel creation permissions are disabled and every MSM channel blocks SDK joins. Keep `false` until the checklist below is verified; chat fails closed otherwise.
- `REQUIRE_STAFF_MFA`: keep `true` in staging and production to require AAL2 for tutor/admin operations. Production enforces AAL2 even if this is accidentally set to `false`.
- `CRON_SECRET`: random server-only secret sent as `Authorization: Bearer <CRON_SECRET>` to the booking-reconciliation route. Production requires at least 32 UTF-8 bytes and rejects template placeholders.

Never create `NEXT_PUBLIC_` variants of server secrets. Use different secrets for test, preview, and production environments. If a credential has appeared in source control or logs, rotate it at the provider; editing the current file is not revocation.

## Supabase, households, and roles

Apply migrations from `supabase/migrations` in filename order. Read `supabase/README.md` before applying them to an existing database; legacy financial and booking data is preserved for deliberate reconciliation.

In Supabase Auth, set the production Site URL to the deployed origin and add each environment's exact `https://<origin>/auth/callback` URL to the redirect allowlist. Signup and magic-link emails explicitly return through that callback so the server can exchange the PKCE code before forwarding to the validated internal destination. Exercise same-browser confirmation links in staging. Cross-device confirmation is not part of this PKCE flow; add and test a separate server-side `token_hash` verification callback before promising that behavior.

The household/payment migration:

- creates one household, owner membership, and parent account role for each new customer signup;
- backfills households for existing customer-like accounts;
- creates explicit placeholder learners for legacy bookings instead of guessing child identities;
- introduces immutable offer versions, payment orders and event inboxes, append-only credit grants/ledger entries, and idempotent booking operations.

After migration:

1. Confirm the five canonical tutors and four logical packages exist.
2. Review every migrated household and replace or assign each `Legacy learner - assignment required` placeholder before relying on historical learner reporting.
3. Exercise household owner permissions for learner management, booking, billing, and household booking visibility.
4. Provision tutor/admin entries in `account_roles` through a trusted service-role/admin workflow. Keep the compatibility `profiles.role` and tutor mapping aligned until a dedicated role-management UI owns that transition.
5. Never insert a verified package purchase or credit grant manually without retained payment evidence and a reviewed migration/adjustment record.

The parent dashboard reads household-scoped booking, entitlement, and learner DTOs. Verify that a member without `can_manage_billing` cannot see entitlements, a member without `can_manage_learners` cannot edit learners and receives redacted birth dates, and a member without `can_view_all_bookings` sees only bookings they created. Deactivate learners with the learner workflow instead of deleting history. Learner creation and updates are rate-limited, and the database transactionally caps each household at 25 total learner rows, including inactive and legacy records. Support must review history instead of deleting rows or bypassing that safeguard.

## Staff MFA

Keep `REQUIRE_STAFF_MFA=true`. Tutor and administrator accounts must enroll a verified Supabase TOTP factor through `/mfa` and reach authenticator assurance level `aal2` before using staff dashboards, protected booking access, or staff chat operations.

Test all of the following with separate parent, tutor, and admin accounts:

- a parent can use household features without staff elevation;
- tutor/admin access redirects an unenrolled account to MFA enrollment;
- an enrolled but unchallenged session must complete MFA verification;
- an AAL2 tutor can access only the tutor identity assigned through the trusted role mapping;
- revoking the staff role or deactivating the profile fails closed.

Do not disable the gate to work around enrollment problems in production.

## Stripe catalog and Checkout

### Legal, tax, and refund prerequisites

Before accepting real money, obtain and record approval for:

- the contracting party and merchant-of-record identity;
- whether displayed EUR prices are tax-inclusive or tax-exclusive and whether the tutoring supply is taxable or exempt;
- Stripe Tax registrations/configuration, invoice wording, and retention requirements;
- cancellation, no-show, package-expiry, withdrawal, full-refund, partial-refund, dispute, and already-consumed-credit rules;
- the customer disclosures and consent required before payment.

`STRIPE_AUTOMATIC_TAX_ENABLED=true` only enables Stripe's calculation feature; it does not decide those legal questions. Keep it `false` until the account registrations, Price tax behavior, displayed prices, invoices, and approved policy agree.

### Publish immutable offers

Create the paid Products and one-time Prices in Stripe first. Use test-mode objects for staging and live-mode objects only for production. Do not invent IDs, reuse test IDs in production, or store Stripe Price IDs in browser code or environment variables.

Copy `supabase/stripe_offer_setup.example.sql`, replace every explicit Product/Price placeholder with IDs returned by Stripe, select the correct test/live mode, and then run it through a trusted migration/operator connection. MSM currently accepts only `inclusive` Price tax behavior so the charged total cannot silently exceed the displayed offer. The template creates new immutable `offer_versions`, moves the `active_offers` pointers, and deliberately leaves checkout disabled. A price, session quantity, currency, tax behavior, or provider mapping change requires another offer version; never update an existing `offer_versions` row.

Before enabling an offer, compare the Stripe Price object with the stored commercial facts: active Product, active Price ID, mode, fixed EUR amount, one-time recurrence, tax behavior, livemode, and exactly one package per Checkout Session. The runtime repeats this check before every fresh Session, pins the Session currency, disables adaptive pricing, and rejects multi-currency, custom-amount, and transformed-quantity Prices.

### Stripe webhook

Create a Stripe webhook endpoint for:

```text
${NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe
```

Subscribe only to the event types handled by the route:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

Store that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`. Test and live endpoints have different secrets. The success page never grants credit: the webhook records the signed event, retrieves the Checkout Session and line item from Stripe, validates the provider facts, and transactionally fulfills the order once. Duplicate delivery must return success without creating another purchase, grant, or ledger credit.

The webhook does not read `PAYMENTS_ENABLED`, `PAYMENTS_LEGAL_APPROVED`, or `active_offers.checkout_enabled`. Keep the route, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Supabase service credentials, and database RPCs available whenever a delayed payment, retry, refund, or dispute can still arrive—even when every new-sale gate is off.

### Fail-closed activation

Use this order:

1. Keep both payment flags and all `active_offers.checkout_enabled` values `false`; take a restorable production backup and restore a production-like staging copy.
2. Apply every migration to staging. Resolve every migration/backfill exception and audit preserved legacy tables, downgraded evidence-free purchases, household memberships, learner placeholders, credit adjustments, provider identities, and tutor overlaps.
3. Deploy the application to staging with test provider/service secrets, staff MFA, both signed webhook routes, and the authenticated reconciliation route. Publish disabled test-mode offers, compare every commercial fact with Stripe, register the callbacks and schedule, and then enable only the reviewed staging offers and both staging gates.
4. Exercise immediate and delayed payment success/failure, expiry, duplicate events, refunds, disputes, local-first booking reservation, deterministic release, ambiguous state, Cal.com events, and cron repair. Reconcile `payment_orders`, `package_purchases`, `credit_grants`, `credit_ledger`, and `stripe_events`; one successful Checkout must create one fulfilled order, purchase, grant, and ledger grant exactly once.
5. During the reviewed production write window, apply the same migrations in filename order and complete the same backfill audit before deploying dependent application code.
6. Deploy production with live provider objects/secrets, signed endpoints, staff MFA, and an authenticated reconciliation schedule that meets the operational SLO, while every new-sale control remains off. Publish the live offer versions disabled and compare them with Stripe and the approved public display.
7. Set `PAYMENTS_LEGAL_APPROVED=true` only after recorded legal/tax/refund approval, set `PAYMENTS_ENABLED=true` when the operations owner authorizes sales, and explicitly enable only the reviewed live offer pointers.

To stop new purchases, set `PAYMENTS_ENABLED=false` and/or disable the relevant `active_offers.checkout_enabled` pointer. If legal approval is withdrawn, set `PAYMENTS_LEGAL_APPROVED=false` too. None of these actions disables the signed Stripe webhook, which must remain operational for fulfillment and financial reconciliation.

## Cal.com scheduling and webhook

Create one active 60-minute event type per tutor, or one intentionally shared event type, and map it in `CALCOM_EVENT_TYPE_IDS_JSON`. Confirm each event type's host, availability, duration, location behavior, and time zone.

Create a signed Cal.com webhook at:

```text
${NEXT_PUBLIC_SITE_URL}/api/webhooks/calcom
```

Configure the same independently generated `CALCOM_WEBHOOK_SECRET` of at least 32 UTF-8 bytes on both sides. Public template values fail closed at runtime. The route verifies the `x-cal-signature-256` HMAC-SHA-256 over the exact raw request body and accepts these triggers:

- `BOOKING_CREATED`
- `BOOKING_REQUESTED`
- `BOOKING_RESCHEDULED`
- `BOOKING_CANCELLED`
- `BOOKING_REJECTED`
- `MEETING_ENDED`

Verify slot lookup, local reservation, provider confirmation, rescheduling, cancellation, meeting completion, replayed events, and out-of-order/stale events in staging. Paid booking input contains no `packagePurchaseId`: the database selects the earliest-expiring, then oldest eligible household credit under lock. Confirm deterministic provider failures release reserved credit, eligible cancellation restores exactly one credit, and ambiguous operations remain marked for reconciliation instead of being guessed successful.

## Scheduled reconciliation

`vercel.json` invokes `GET /api/cron/reconcile-bookings` once daily at `17 3 * * *`, which is compatible with Vercel Hobby. Hobby execution can occur at any point within the 03:00 UTC hour. Set an independently generated `CRON_SECRET` of at least 32 UTF-8 bytes; public template values fail closed at runtime. The route accepts only `Authorization: Bearer <CRON_SECRET>` and returns `401` otherwise. Signed Cal.com webhooks are the real-time synchronization path. For production repair with a tighter SLO, use Vercel Pro or configure an equivalent hourly HTTPS job with the same header. Never put the secret in a query string or client bundle.

Each bounded run reserves 15 slots for pending, reconciliation-needed, or ended Cal.com bookings and five independent slots for upcoming scheduled-booking audits in the next 30 days. Eligible audit rows are ordered by oldest check, and a row becomes eligible again after six hours; five rows per run is a throughput limit, not a promise that every row is checked within six hours. A sustained urgent backlog therefore cannot starve drift detection, but a larger scheduled population can create an audit backlog. The daily Hobby schedule is suitable only when signed webhooks carry normal synchronization traffic and that throughput meets the reviewed SLO. Alert whenever the cron response reports `possiblyMore=true` across consecutive runs, and increase the schedule or reviewed batch capacity before the oldest eligible audit exceeds the operational SLO. The job applies provider observations through the same idempotent database event processor as the webhook. It never repeats an external create. For a UID-less ambiguous create it performs a bounded Cal.com list search by attendee, a narrow window around the atomically recorded provider-attempt time, and the exact internal booking UUID stored in metadata. A unique match is adopted. Only after that attempt is at least 24 hours old and two complete negative searches are at least one hour apart does the job fail the local create and release eligible reserved credit. A newly claimed attempt resets prior negative evidence. Duplicate or truncated provider results stay unresolved for operator review.

For ambiguous cancel or reschedule calls, repeated active snapshots that prove the provider state remained unchanged eventually fail the local operation and restore the prior lifecycle. A missing source UID triggers a bounded exact internal-ID and lineage search from the last provider sync. A cancelled source without a proven replacement and a completely absent source each need two complete observations at least one hour apart and at least two hours after the provider attempt before cancellation is settled; a replacement tail is adopted instead. A signed external cancellation is also staged first. If its UID subsequently disappears, two spaced absence observations are required before cancellation becomes terminal. If the exact same UID remains active or pending, two spaced identical provider-state observations are required before the staged cancellation is reversed to `scheduled` or `pending_confirmation`. All such observations are append-only and tied to the exact staged provider event; changed intervals/statuses reset the evidence. Active, pending, absent, and cancelled evidence cannot be combined. A later authoritative webhook can still apply the provider fact safely.

The public Stripe and Cal.com webhook endpoints authenticate with their provider signatures, not `CRON_SECRET`. Do not point the scheduler at webhook endpoints or synthesize provider events. Alert on non-2xx cron runs and persistent `needs_reconciliation`, pending, unresolved, provider-error, or RPC-error counts.

## Sendbird

Create a Sendbird application and set its server environment variables. Chat is server mediated: browsers call only MSM's authenticated routes and never receive a Sendbird application ID, user ID, token, channel URL, or Chat SDK bundle. As legacy defense before enabling chat, open **Sendbird Dashboard → Settings → Application → Security → Access token permission setting** and require an authentication token for every SDK connection. After verifying the provider setting in the correct application and environment, set `SENDBIRD_TOKEN_AUTH_REQUIRED=true`.

In **Sendbird Dashboard → Settings → Application → Security → Access control list**, turn off all four SDK permissions named **Allow retrieving user list**, **Allow updating user metadata**, **Allow creating open channels**, and **Allow creating group channels**. New MSM channels also set `block_sdk_user_channel_join=true`. Because Sendbird's documented channel read does not return that creation flag, MSM writes an application-and-channel-bound HMAC contract in the same atomic create request and requires it on every later read. Never add the seal to an old channel through an update: unsealed channels must remain fail closed and be recreated through the approved history migration. Test that a legacy SDK client cannot enumerate users, create a channel, join another channel, or invite an unrelated booking identity. Only after this exact application and environment pass the check should `SENDBIRD_RESTRICTED_ACL_REQUIRED=true` be set.

Both environment flags are operator attestations; the application cannot inspect the remote Dashboard configuration. The server refuses every Sendbird Platform API operation unless both are exactly `true`, so release review must verify the provider state before changing them.

The server derives a separate opaque identity for each side of each exact booking and a deterministic channel URL for that booking. It creates a strict, private, non-ephemeral, non-distinct channel with exactly those two joined members, no operators, and blocked SDK joins. Before every message list or send, the server rechecks the live booking and repairs membership by removing unexpected users, joining missing expected users, and re-reading the exact result. A member with `can_view_all_bookings=false` is limited to bookings they created; tutor-side calls require AAL2. Only `MESG` text up to 2,000 characters is accepted. Reads poll only while the page is visible, and both reads and sends are database rate limited.

Before upgrading an existing Sendbird application, list legacy global users named `msm_<auth-user-uuid>` and revoke all their session tokens with Sendbird's `DELETE /v3/users/{user_id}/token` Platform API. The previous implementation could issue the provider's seven-day default token. Do not release until legacy tokens are revoked (or their full prior lifetime has elapsed), tokenless connections are disabled, and ACLs are restricted.

The deterministic channel URL is a storage boundary change. Inventory each legacy generated or distinct booking channel, map it to the exact internal booking, and migrate any history that must be retained into the corresponding deterministic channel through an approved Sendbird migration procedure. Verify message order, sender mapping, retention, and legal deletion requirements in staging. Keep chat disabled during the cutover; do not silently abandon or delete legacy history, and do not treat deletion as token revocation.

Test booking isolation, restricted household members, 15-second visible-page polling, older pagination after long hidden intervals, idempotent send retries, terminal or revoked authorization, deterministic channel/history migration, exact membership and operator repair, legacy-token revocation, and staff MFA in staging.

## Release checks

Run:

```bash
npm run check
```

Before production, also verify:

- migrations and reviewed legacy backfills succeeded in a staging copy;
- RLS and service-role-only mutation boundaries are effective;
- `NEXT_PUBLIC_SITE_URL` is the exact canonical HTTPS origin and Supabase auth redirects match it;
- all secrets are environment-scoped, rotated, and absent from browser bundles/logs;
- staff role provisioning and AAL2 enforcement work for tutors and administrators;
- household permissions, learner ownership/redaction, and dashboard scope prevent cross-household access;
- every Stripe offer exactly matches its immutable database version and only reviewed offers are checkout-enabled;
- checkout creation fails when either new-sales gate is false while valid Stripe webhooks continue to process;
- Stripe and Cal.com signatures reject altered payloads and webhook replays remain idempotent;
- payment, refund, dispute, automatic oldest-eligible credit selection, booking, cancellation, and credit-ledger invariants reconcile under concurrency and retries;
- scheduled reconciliation is authenticated and alerts on exhausted/ambiguous work;
- database-backed rate limits reject excess slot, checkout, booking, and chat traffic and fail closed when unavailable;
- structured error monitoring, provider latency/error alerts, and an operator runbook are in place.
