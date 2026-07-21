# MSM setup and release guide

The application uses Supabase for authentication and persistence, Cal.com v2 for scheduling, and Sendbird for parent–tutor chat. There is no mock-success fallback: missing server configuration causes protected operations to fail closed.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Keep `.env.local` out of source control.

## Environment contract

Copy the names from `.env.example` and replace every placeholder:

- `NEXT_PUBLIC_SITE_URL`: canonical site origin; use `http://localhost:3000` locally.
- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key.
- `CALCOM_API_KEY`: server-only Cal.com API key.
- `CALCOM_EVENT_TYPE_IDS_JSON`: JSON object mapping every canonical tutor slug to a Cal.com event-type ID.
- `CALCOM_DEFAULT_EVENT_TYPE_ID`: optional fallback only when all tutors deliberately share one event type.
- `SENDBIRD_APP_ID`: Sendbird application ID. It is returned to authenticated chat clients by the token endpoint.
- `SENDBIRD_API_TOKEN`: server-only Sendbird Platform API token.

Do not create `NEXT_PUBLIC_` variants of server secrets. If a credential has ever been committed, rotate it at the provider; editing the current file does not remove it from Git history.

## Supabase

Apply migrations from `supabase/migrations` in filename order using the Supabase CLI or dashboard SQL editor. Read `supabase/README.md` before applying the foundation migration to an existing database: incompatible legacy tables are preserved for an audited import rather than converted heuristically.

After migration:

1. Confirm the five canonical tutor rows and four package rows exist.
2. Create user accounts through Supabase Auth.
3. Assign tutor accounts by setting `profiles.role = 'tutor'` and the corresponding `profiles.tutor_id` in a trusted admin workflow.
4. Assign administrators by setting `profiles.role = 'admin'` in a trusted admin workflow.
5. Never mark a package purchase as payment-verified without evidence from the payment provider.

The repository does not yet include checkout or payment-webhook ingestion. Paid package credits therefore need a separate, trusted provisioning flow before paid booking can be released.

## Cal.com

Create one active, 60-minute event type per tutor (or one deliberately shared event type), configure its host and availability, then put the numeric IDs in `CALCOM_EVENT_TYPE_IDS_JSON`. The application calls Cal.com v2 only from server routes; API keys and provider booking UIDs are never accepted from or returned to the browser.

Verify slot lookup, booking, rescheduling, and cancellation in a staging Cal.com account. A webhook/reconciliation job is still recommended before production so provider/database drift can be detected after partial outages.

## Sendbird

Create a Sendbird application and set the two server environment variables. The server creates opaque user IDs from authenticated Supabase UUIDs and issues short-lived session tokens. Parent channel creation is allowed only after a booking with the selected tutor exists; tutors must reference an assigned booking.

## Release checks

```bash
npm run check
```

This runs lint, generated-route type checking, unit tests, and a production build. Run it with placeholders or staging credentials; the build itself does not call external providers.

Before production, also verify:

- the database migration was applied and RLS is enabled;
- every tutor slug resolves to the intended Cal.com event type;
- Supabase auth callback URLs match the deployed site origin;
- Sendbird token and channel flows work for a parent and assigned tutor;
- provider secrets are available only to server runtimes;
- cancellation restores exactly one paid credit and repeated cancellation is idempotent at the database boundary;
- observability alerts cover Cal.com/database synchronization failures.
