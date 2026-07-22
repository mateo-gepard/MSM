# MSM setup and release guide

The application uses Vercel Functions as its server API, Supabase for identity, persistence, and private Realtime chat, Stripe Checkout for one-time package payments, and Cal.com v2 for scheduling. Household permissions, payment facts, credit accounting, and booking lifecycle state remain authoritative in MSM. Provider callbacks are signature-verified inputs, not authorization decisions.

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
- `REQUIRE_STAFF_MFA`: keep `true` in staging and production to require AAL2 for tutor/admin operations. Production enforces AAL2 even if this is accidentally set to `false`.
- `CRON_SECRET`: random server-only secret sent as `Authorization: Bearer <CRON_SECRET>` to the booking-reconciliation route. Production requires at least 32 UTF-8 bytes and rejects template placeholders.

Never create `NEXT_PUBLIC_` variants of server secrets. Use different secrets for test, preview, and production environments. If a credential has appeared in source control or logs, rotate it at the provider; editing the current file is not revocation.

## Vercel API and integration setup

Every `src/app/api/**/route.ts` handler deploys as a Vercel Function on the application origin. Browsers call only these MSM endpoints for privileged reads and mutations. Stripe, Cal.com, the Supabase service role, webhook signing secrets, `RATE_LIMIT_SECRET`, and `CRON_SECRET` remain server-only Vercel Environment Variables. Use separate Development, Preview, and Production values; Preview must never point at live Stripe credentials or an unreviewed production database.

The Vercel Marketplace can connect the existing Supabase and Stripe resources and synchronize generated credentials into the project. Connect the existing resources rather than provisioning replacements after data exists. Marketplace connection does not configure application-specific webhook secrets, Cal.com event mappings, payment gates, or the `CRON_SECRET`; set those explicitly. After changing any environment variable, redeploy before testing it. For local development, link the correct project deliberately and run `vercel env pull .env.local`; this file is ignored by Git and must never be committed.

Use one canonical HTTPS origin for `NEXT_PUBLIC_SITE_URL` and register its exact Vercel routes with the providers:

- Stripe: `/api/webhooks/stripe`
- Cal.com: `/api/webhooks/calcom`
- Supabase Auth: `/auth/callback`
- Vercel Cron: `/api/cron/reconcile-bookings`

The Vercel project must use a Node.js version accepted by `package.json`. Database and provider routes use the default Node.js runtime; do not move them to Edge without revalidating cryptography, request-body verification, and provider SDK compatibility.

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

## Supabase booking chat

Apply `20260722000100_supabase_booking_chat.sql` after the two existing migrations. It creates append-only `booking_messages`, keeps all writes behind the authenticated Vercel API, and emits a minimized private Supabase Realtime broadcast after each committed insert. The broadcast includes only message ID, text, timestamp, and sender side. Internal user IDs, contact data, and booking/provider identifiers are not part of its payload.

In **Supabase Dashboard → Realtime Settings**, disable public channel access. Clients subscribe only to `booking:<booking-uuid>` with `private: true`. The `booking_chat_broadcast_receive` policy authorizes the topic against the live booking, active household membership or assigned tutor role, active profiles, and tutor AAL2. Clients receive no database write permission and cannot publish broadcasts. History reads and sends still pass through `/api/chat/channels`, which repeats authorization and database-backed rate limiting on every request.

Realtime is an acceleration path rather than the source of truth. The visible page reconciles through the Vercel history API every 60 seconds and refreshes the private Realtime authorization connection every five minutes. This recovers missed broadcasts and bounds stale application-role authorization. Message retries retain one client UUID; the unique sender/idempotency constraint returns the original row only when booking, side, and body are identical.

Before production, test cross-household denial, restricted household members, tutor AAL1 denial and AAL2 success, terminal booking denial, private-channel subscription rejection, reconnect/replay recovery, older pagination, concurrent idempotent retries, and rate limits. Define message retention, export, legal hold, moderation, and deletion procedures before broad use. If legacy provider chat history exists, inventory and migrate it through a separately reviewed import that preserves booking, sender side, timestamp, order, and audit evidence; do not silently abandon or delete history.

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
- Supabase Realtime public access is disabled and private booking topics reject unrelated, revoked, terminal, and tutor-AAL1 sessions;
- database-backed rate limits reject excess slot, checkout, booking, and chat traffic and fail closed when unavailable;
- structured error monitoring, provider latency/error alerts, and an operator runbook are in place.
