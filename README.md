# MSM tutoring platform

MSM is a responsive German tutoring marketplace built with Next.js 16, React 19, TypeScript, and Tailwind CSS. It includes tutor discovery and matching, live Cal.com availability and booking, Supabase authentication and dashboards, and authorized one-to-one Sendbird chat.

## Architecture

- `src/domain/catalog.ts` is the canonical source for public tutor, subject, and package identifiers.
- Supabase Auth uses request-scoped SSR clients and cookie refresh in `src/proxy.ts`.
- Protected Next.js route handlers own booking, entitlement, profile, and chat authorization.
- Cal.com v2 and Sendbird Platform API credentials are server-only.
- Supabase row-level security limits direct reads; privileged booking and credit mutations are transactional service-role RPCs.
- Client dashboards consume redacted DTOs rather than querying sensitive tables or provider identifiers directly.

The application deliberately has no fake-success or local-storage persistence fallback. Missing provider configuration produces an explicit error.

## Local development

Node.js 20.9 or newer is required.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The public UI and production build can render with placeholder configuration, but authentication, booking, and chat require real staging services.

## Configuration

`.env.example` is the authoritative environment-variable template. Server secrets must never use the `NEXT_PUBLIC_` prefix or be committed.

Before exercising protected flows:

1. Apply `supabase/migrations` and provision parent, tutor, or admin profiles.
2. Configure a live Cal.com event type and availability for each canonical tutor slug.
3. Configure the Sendbird application and Platform API token.
4. Add the deployed `/auth/callback` URL to Supabase Auth redirect URLs.

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

- Clients submit stable catalog IDs, never prices, provider booking IDs, user IDs, or Cal.com event-type IDs.
- Booking creation is limited to authenticated parent profiles and validates trial or paid-credit eligibility both before the provider call and inside a locking database transaction.
- Cancellation and rescheduling resolve the Cal.com UID from an authorized internal booking UUID.
- Paid cancellation restores one credit exactly once at the database boundary.
- Parent chat requires a booking relationship; tutor chat requires the tutor mapping and an assigned booking.
- Safe redirect handling accepts only local application paths.

Rotate any secret that has appeared in Git history. Removing a value from the current tree is not credential revocation and does not rewrite repository history.

## Known release dependencies

- Paid packages require a payment checkout/webhook provisioning flow. The application will not treat an unverified purchase as credit.
- Cal.com webhook ingestion or a reconciliation job is recommended to detect provider/database drift after partial outages.
- Apply and validate the migration against a staging copy of any existing Supabase database before production import.
- Add production rate limiting, alerting, and provider-failure monitoring at the deployment edge.

## License

Proprietary. All rights reserved.
