# MSM tutoring platform

MSM is a responsive German tutoring marketplace built with Next.js 16, React 19, TypeScript, and Tailwind CSS. It includes tutor discovery and matching, household and learner management, Stripe-hosted package checkout, live Cal.com scheduling, Supabase authentication and dashboards, and authorized one-to-one Sendbird chat.

## Architecture

- `src/domain/catalog.ts` defines stable public tutor, subject, and package identifiers plus fail-closed presentation fallback copy; immutable database `offer_versions` hold the displayed and sold commercial facts.
- Supabase Auth uses request-scoped SSR clients and cookie refresh in `src/proxy.ts`.
- Household membership permissions govern learner management, booking, billing, and household-wide booking visibility.
- Protected Next.js route handlers own checkout, booking, entitlement, household, profile, and chat authorization.
- Stripe Checkout creates one-time payment sessions; signed Stripe webhooks are the only path that fulfills purchases and grants credits.
- Cal.com v2 creates scheduling operations, while HMAC-signed Cal.com webhooks and an authenticated scheduled repair job reconcile provider lifecycle changes.
- Supabase row-level security limits direct reads; privileged payment, booking, and append-only credit-ledger mutations are transactional service-role RPCs.
- Tutor and administrator operations require Supabase AAL2 multi-factor authentication in production.
- Client dashboards consume redacted DTOs rather than querying sensitive tables or provider identifiers directly.

The application deliberately has no fake-success or local-storage persistence fallback. Missing provider configuration produces an explicit error. Creating a new Checkout Session additionally requires both `PAYMENTS_ENABLED=true` and `PAYMENTS_LEGAL_APPROVED=true`; the supplied environment template keeps both gates off. Those gates never disable signed Stripe webhook fulfillment or financial reconciliation.

## Local development

Node.js 20.9 or newer is required.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The public UI and production build can render with placeholder configuration, but authentication, booking, checkout, webhooks, and chat require real staging services.

## Configuration

`.env.example` is the authoritative environment-variable template. Server secrets must never use the `NEXT_PUBLIC_` prefix or be committed.

Before exercising protected flows:

1. Rehearse and audit the legacy backfill in staging, then apply `supabase/migrations` in filename order. New customer accounts receive a household, owner membership, and parent role automatically; review migrated household and learner placeholders before production.
2. Provision tutor/admin roles through a trusted server-side workflow and enroll staff MFA.
3. Configure a Cal.com event type per tutor and the signed `/api/webhooks/calcom` endpoint.
4. Configure Stripe test-mode credentials, signed `/api/webhooks/stripe`, and immutable offer versions using `supabase/stripe_offer_setup.example.sql`. Do not enable checkout yet.
5. Configure the Sendbird application, Platform API token, and a unique stable channel-contract secret.
6. Add the deployed `/auth/callback` URL to Supabase Auth redirect URLs and configure the authenticated `/api/cron/reconcile-bookings` job with `CRON_SECRET`. The checked-in schedule is Hobby-compatible and runs daily; use Vercel Pro or an equivalent scheduler for hourly production repair when the operational SLO requires it.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for the release checklist and [API_INTEGRATION.md](API_INTEGRATION.md) for route contracts. Existing-database migration notes are in [supabase/README.md](supabase/README.md).

## Quality checks

```bash
npm run check
```

The check runs ESLint, Next.js route type generation plus TypeScript, Vitest, and a production build. Focused commands are also available:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Security model

- Clients submit stable catalog IDs and UUID idempotency keys, never prices, user IDs, provider booking IDs, Stripe Price IDs, or Cal.com event-type IDs.
- Checkout resolves a server-owned active offer and validates the live Stripe Product/Price against its immutable order before issuing a fixed-currency Session. The success page never grants credit; a signature-verified, replay-safe Stripe webhook validates and fulfills the payment exactly once.
- Household permissions scope learners, package purchases, and bookings. New bookings require an active learner in the caller's household.
- Paid booking never accepts a purchase/grant ID: the database reserves the earliest-expiring, then oldest eligible household credit before the Cal.com call. Provider confirmation consumes it; deterministic failure releases it; ambiguous results remain queued for reconciliation.
- Creation, cancellation, and rescheduling use atomically claimed idempotent operations. A queued operation can be resumed safely; a possibly dispatched provider call is never repeated blindly.
- Eligible paid cancellation restores one credit exactly once through an append-only ledger entry.
- HMAC-signed Cal.com events and the scheduled repair loop reconcile booking lifecycle and provider drift without granting payment authority to Cal.com. Every run reserves capacity for upcoming-booking audits even under a sustained pending backlog. A UID-less ambiguous create is recovered only by an exact internal booking UUID match around the actual provider-attempt time; two complete, spaced negative searches are required before its reservation is released. Missing mutation UIDs are searched by internal ID and replacement lineage, and incompatible active/absent/cancelled evidence is never combined. Absence or unchanged same-UID presence evidence for a staged external cancellation is durably tied to the signed event that caused the pending state and requires two consistent observations.
- Sensitive mutations and provider-backed reads use privacy-preserving, database-backed rate limits keyed by an HMAC identity.
- Production staff MFA requires AAL2 for tutor/admin dashboards, booking access, and chat operations.
- Chat is server mediated and text only. The browser receives no Sendbird application ID, user ID, token, or channel URL. Every message read and send re-authorizes one exact live booking; tutors require AAL2, and completed, cancelled, and failed bookings do not qualify.
- Safe redirect handling accepts only local application paths.

Rotate any secret that has appeared in Git history. Removing a value from the current tree is not credential revocation and does not rewrite repository history.

## Production activation gates

- Keep `PAYMENTS_ENABLED=false`, `PAYMENTS_LEGAL_APPROVED=false`, `STRIPE_AUTOMATIC_TAX_ENABLED=false`, and every `active_offers.checkout_enabled=false` until the migration/backfill, legal, VAT, refund, test-mode webhook, and reconciliation checks in `SETUP_GUIDE.md` are complete.
- Do not invent or commit Stripe Product/Price IDs. Publish the provider-created IDs as a new immutable offer version, then move the `active_offers` pointer deliberately.
- Stop new sales with the operational gate and/or the relevant `active_offers.checkout_enabled` pointer. Keep the signed Stripe webhook route and secrets available: webhook fulfillment, retries, refunds, and disputes remain active even while both environment sales gates are false.
- Validate migrations and legacy financial/learner backfills against a staging database, require staff MFA, configure scheduled reconciliation and `RATE_LIMIT_SECRET`, and add provider-failure alerting before production traffic.
- Require tokens in Sendbird's provider-side Access token permission setting, disable the SDK user-list, metadata, and open/group-channel creation ACLs, and revoke every legacy global-user session token during upgrade. Migrate retained history from legacy generated channels into the new deterministic booking channels before switching traffic. Only then set both `SENDBIRD_TOKEN_AUTH_REQUIRED=true` and `SENDBIRD_RESTRICTED_ACL_REQUIRED=true`.

## License

Proprietary. All rights reserved.
