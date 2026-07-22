# Server API contract

All browser mutations go through same-origin Next.js route handlers. JSON requests must send `Content-Type: application/json`; unknown body fields are rejected. Authenticated routes use the Supabase session cookie established by the SSR auth flow.

Successful application responses normally use `{ "data": ... }`. Errors use:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE"
  }
}
```

The browser maps stable codes to local German copy. Server and provider details are never returned
in application error bodies; these responses are private and non-cacheable.

Stripe and Cal.com webhooks, plus the internal cron route, use provider/operations response envelopes instead. Protected responses set private no-store caching where applicable.

Provider credentials, the Supabase service-role key, Stripe Product/Price IDs, Cal.com booking UIDs and event-type IDs, database user IDs, and the Sendbird API token are never accepted as browser input. Internal booking and learner UUIDs are accepted only on routes that re-authorize them against the active principal.

## Identity, household permissions, and MFA

`account_roles` is the server-owned role source; roles are additive. Household access is separately derived from the active `household_memberships` row for `profiles.primary_household_id`:

- `can_manage_learners` controls learner creation and editing;
- `can_book` controls credit visibility and booking;
- `can_manage_billing` controls Checkout and entitlement visibility;
- `can_view_all_bookings` expands parent booking and chat scope from the creator to the household.

Staff-sensitive tutor and administrator dashboard, booking, and chat operations require Supabase authenticator assurance level `aal2` when staff MFA is enabled. Production always enforces staff MFA; `REQUIRE_STAFF_MFA=false` is only a local non-production escape hatch. A valid Supabase session without an active profile and role grant fails closed.

Every checkout, booking-create, cancellation, and reschedule request requires a fresh UUID `idempotencyKey`. Retrying the same logical operation must reuse its key. Reusing a key for changed input is rejected.

## Public catalog and pricing

`src/domain/catalog.ts` defines stable tutor slugs, subject IDs, package IDs, and non-commercial presentation fallback copy. It is not the sales-price authority.

The public pricing section and Checkout resolve the selected `active_offers` pointer to an immutable `offer_versions` row. That row owns the sold name, lesson quantity, total amount, currency, Stripe mapping, mode, tax behavior, and effective window. If those facts change, publish a new version and move the pointer; never update an existing version. A static fallback may render when database pricing is unavailable, but it always disables checkout.

New Checkout sessions require all three controls:

- `PAYMENTS_ENABLED=true`;
- `PAYMENTS_LEGAL_APPROVED=true`;
- `active_offers.checkout_enabled=true` for the selected package.

These are new-sales gates only. `POST /api/webhooks/stripe` deliberately remains active when either environment gate or an offer's checkout flag is off, so delayed payments, refunds, disputes, and webhook retries can still reconcile.

## Slots

`GET /api/slots?tutorSlug=<slug>&start=<ISO>&end=<ISO>&timeZone=<IANA>`

- Public and read-only for ordinary availability.
- The requested range can span at most 31 days and start at most one year ahead.
- The server resolves the tutor's Cal.com event type, overlays active canonical and reschedule claims from the local exclusion domain, and returns only still-selectable slot start times. The final booking transaction remains authoritative.
- An optional `bookingId=<internal UUID>` requests reschedule-aware availability. That variant requires authentication and booking access; the server resolves the authorized provider UID itself.

## Checkout and payment fulfillment

`POST /api/checkout/sessions`

- Requires an authenticated account with the `parent` role, an active household membership with `can_manage_billing`, and an account email.
- Requires both environment activation gates. The database then resolves and snapshots the current, enabled, effective Stripe offer.
- The client sends a package ID and UUID idempotency key only—never an amount, currency, session count, or Stripe Price ID.
- A replay returns an already attached open Checkout Session only after re-reading it from Stripe and matching its order references, mode, one fixed EUR line item, amount, Price, tax behavior, quantity, and live/test mode. Before any fresh Session is created, even a retained pending order must still reference the enabled, current active offer. A paid replay returns the dashboard URL; a terminal unpaid order requires a new idempotency key.
- Before redirecting the customer, the server retrieves the Stripe Price and expanded Product and matches their IDs, active state, one-time fixed amount, EUR currency, inclusive tax behavior, and live/test mode to the immutable order. Checkout pins the integration currency and disables adaptive pricing; multi-currency, custom-amount, and transformed-quantity Prices are rejected.

```json
{
  "packageId": "medium",
  "idempotencyKey": "3d6f0a89-748d-4f23-b21e-8809628abade"
}
```

The response contains the internal order ID and Stripe-hosted URL:

```json
{
  "data": {
    "orderId": "00000000-0000-4000-8000-000000000000",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

The `/checkout/success` page is informational and never grants credit.

`POST /api/webhooks/stripe`

- Public provider callback authenticated with Stripe's signature over the raw body and `STRIPE_WEBHOOK_SECRET`.
- Does not require a user session, `CRON_SECRET`, either new-sales gate, or an enabled active-offer pointer.
- Records the signed event in the replay-safe Stripe inbox before processing it.
- For successful Checkout, retrieves the Session and line item from Stripe and requires a paid, one-item, quantity-one payment whose Price, amount, currency, and live/test mode match the snapshotted order and immutable offer.
- Only successful fulfillment creates the verified `package_purchase`, `credit_grant`, and append-only grant ledger entry. Duplicate delivery returns success without granting twice.
- Reconciles asynchronous failure/expiry, refunds, and disputes without trusting the browser success redirect.
- Relevant Stripe event types are correlated to a local Session or PaymentIntent before mutation. Signed events for unrelated Stripe objects are recorded and terminally ignored; a genuine event racing local Session attachment remains retryable. An unpaid `checkout.session.completed` is terminal for that event and waits for the later asynchronous-success event instead of remaining stuck in the inbox.

Handled Stripe events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `refund.created`, `refund.updated`, `refund.failed`
- `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`

## Credits and entitlements

`GET /api/credits`

- Requires an authenticated `parent` role and household `can_book` permission.
- Returns aggregate remaining lesson counts by paid package ID.
- Deliberately omits purchase/grant IDs. It is an availability view; the database rechecks and reserves a specific eligible grant during booking.

`GET /api/packages`

- Requires an authenticated `parent` role.
- Returns payment-verified household entitlement DTOs only when the principal has `can_manage_billing`; otherwise the list is empty.
- Purchase IDs may appear for dashboard display, but no booking mutation accepts them.

## Learners

`GET /api/learners`

- Requires an authenticated `parent` role and an active household.
- Returns household-scoped learner DTOs. Birth dates are redacted unless the membership has `can_manage_learners`.

`POST /api/learners`

- Requires `can_manage_learners`.
- Accepts `{ "displayName": "...", "birthDate": "YYYY-MM-DD" }`; `birthDate` is optional and cannot be in the future.
- Household ownership fields are not accepted from the client.
- Is limited to ten creates per authenticated user per hour. A transaction-scoped database lock caps each household at 25 total learner records, including inactive and legacy rows, so concurrent requests cannot bypass the limit.

`PATCH /api/learners/:learnerId`

- Requires `can_manage_learners` and scopes the UUID to the current household.
- Accepts one or more of `displayName`, nullable `birthDate`, and `isActive`.
- Is limited to 60 updates per authenticated user per hour.
- Editing the name or birth date clears the migration's legacy-placeholder marker. Use `isActive=false` to deactivate a learner; there is no destructive learner-delete route.

The parent dashboard loads bookings, billing entitlements, and learner data together and exposes learner controls only when the resolved household permissions allow them.

## Bookings

`GET /api/bookings`

- Requires authentication; staff callers must be at AAL2.
- Without an explicit tutor scope, an account that holds `parent` uses its household view: `can_view_all_bookings` returns the household's bookings, otherwise only bookings that account created. This remains true for an additive parent+tutor/admin account.
- A staff-only tutor receives bookings assigned to their mapped tutor identity.
- A staff-only administrator must provide `?tutorSlug=<slug>`. An administrator may use any explicit tutor scope; a tutor may use only their own mapped slug.
- Responses are redacted dashboard DTOs; provider, credit-ledger, and ownership internals are omitted. An HTTPS meeting URL is included only for an authorized booking participant and rendered for active online lessons.

`POST /api/bookings`

- Requires an authenticated `parent` role, an active household membership with `can_book`, and an active learner in that household.
- Validates tutor/subject/location compatibility, a start within the next year, and that the contact email matches the signed-in account.
- `learnerId` may be omitted only when the household has exactly one active learner. The shipped booking UI always asks the user to choose a learner.
- Never accepts `packagePurchaseId`. For a paid package, the locking database transaction automatically chooses the eligible household grant with the earliest expiry, then the oldest creation time, and finally a stable purchase-ID tie-breaker.
- Creates the local booking and operation and reserves one credit in the append-only ledger before calling Cal.com. The provider call requires an atomic operation claim: a queued replay may claim and continue, while a processing or ambiguous operation is never sent twice. This local-first reservation prevents concurrent double-spend and tutor-slot overlap.
- Provider confirmation changes the reservation to consumed and decrements the purchase projection. A deterministic provider rejection releases the reservation exactly once. A timeout or other ambiguous result remains pending for webhook/cron/manual reconciliation and returns HTTP `202`; the route never blindly repeats an external create.

Example paid booking body:

```json
{
  "idempotencyKey": "0e61af76-4b62-4f20-89e3-e3140b39d33b",
  "tutorSlug": "mateo-mamaladze",
  "subjectId": "physics",
  "packageId": "medium",
  "learnerId": "00000000-0000-4000-8000-000000000001",
  "startsAt": "2026-08-10T14:00:00.000Z",
  "timeZone": "Europe/Berlin",
  "location": "online",
  "contact": {
    "name": "Example Parent",
    "email": "parent@example.invalid"
  }
}
```

Trial requests use `"packageId": "trial"` and no payment entitlement. Trial eligibility is enforced for the whole household inside the same reservation transaction.

`DELETE /api/bookings/:bookingId/cancel`

- Requires the authorized household booker, assigned tutor, or administrator. Staff callers require AAL2.
- The path value is the internal booking UUID, never a Cal.com UID.
- Begins an idempotent local `cancellation_pending` operation before calling Cal.com.
- Only a same-UID provider response with an explicit cancelled status and no replacement UID completes cancellation immediately. Eligible reserved/consumed paid credit is restored exactly once through the ledger.
- A 404, conflict, mismatched UID, non-terminal status, or replacement UID is ambiguous, never proof that the logical lesson was cancelled. Reconciliation follows the replacement lineage or requires two complete terminal observations at least one hour apart before settling a genuinely absent/cancelled source.
- Ambiguous provider or local-completion results return HTTP `202` and remain queued for reconciliation.

```json
{
  "idempotencyKey": "7aa34266-32cb-43c7-a66a-81091167fd87",
  "reason": "Schedule changed"
}
```

`PATCH /api/bookings/:bookingId/reschedule`

- Uses the same booking authorization and MFA boundary as cancellation.
- Requires a future start within one year and begins an idempotent local `reschedule_pending` operation before the provider call.
- The server derives the provider booking UID from the authorized database row.
- Explicit authorization or validation rejection fails the operation. Source-UID absence and provider state conflicts remain ambiguous because an external mutation may have won the race; those and local-completion uncertainty return HTTP `202` for reconciliation.

```json
{
  "idempotencyKey": "d9902f8a-f108-486f-b001-56dd9345c009",
  "startsAt": "2026-08-12T15:00:00.000Z",
  "timeZone": "Europe/Berlin",
  "reason": "School event"
}
```

## Cal.com lifecycle synchronization

`POST /api/webhooks/calcom`

- Public provider callback authenticated by an HMAC-SHA-256 of the exact raw body in `x-cal-signature-256` using `CALCOM_WEBHOOK_SECRET`.
- Accepts `BOOKING_CREATED`, `BOOKING_REQUESTED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_REJECTED`, and `MEETING_ENDED`.
- Converts the provider event to a replay-safe inbox observation. Database processing rejects event-ID collisions, ignores stale/out-of-order transitions where appropriate, and applies lifecycle/credit effects transactionally.

`GET /api/cron/reconcile-bookings`

- Internal route authenticated only by `Authorization: Bearer <CRON_SECRET>`.
- `vercel.json` schedules it hourly with `0 * * * *`.
- Uses a fixed bounded split of 15 urgent slots and five independent scheduled-audit slots, so persistent pending work cannot fully starve upcoming-booking drift detection. Scheduled rows become eligible after six hours and are processed oldest-first, but the five-per-hour audit slice is explicitly a throughput bound rather than a six-hour completion guarantee. Consecutive `possiblyMore=true` responses require an operational backlog alert and capacity review. Known UIDs use a direct provider lookup and bounded, cycle-checked reschedule-lineage traversal; a 404 falls back to a complete bounded internal-ID search from the last known provider sync. UID-less creates use a narrow bounded list search for the exact internal booking UUID in provider metadata. A staged signed external cancellation requires two spaced, append-only observations tied to that exact provider event: continued absence settles cancellation, while an unchanged same-UID active or pending state restores `scheduled` or `pending_confirmation`. Provider-state fingerprints prevent unlike evidence from being combined.
- Never recreates an external booking. A unique exact match is adopted. The lookup window is anchored to the recorded provider-attempt time. A missing match releases eligible reserved credit only after that attempt is at least 24 hours old and two complete negative searches are at least one hour apart; a later claim resets older evidence, while duplicates and truncated searches remain unresolved.
- Repeated authoritative active snapshots that show an ambiguous cancel or reschedule was never applied close the stranded operation and restore its previous local lifecycle. Missing or cancelled source UIDs use a separate evidence kind and require two complete, spaced observations before the logical lesson is cancelled; incompatible evidence resets the counter. A lineage-linked replacement is adopted instead.
- Returns reconciliation counters and reports HTTP `503` when every selected candidate fails to reconcile.

Signed webhooks are the primary synchronization path; the hourly job is a repair loop for missed delivery and provider/database drift.

## Profile and chat

`GET /api/profile`

Returns the active account's primary role, complete role list, display name, and mapped tutor slug where applicable.

Chat is server mediated and text only. There is no token route and the browser never receives a Sendbird application ID, user ID, session token, API token, or channel URL. The server derives both opaque booking-side identities and the deterministic channel URL internally. Each provider read or send is preceded by fresh authorization of that exact live booking and exact side. `can_view_all_bookings=false` limits a household member to bookings they created; tutor callers require AAL2, and administrator status alone never authorizes chat.

The deterministic provider channel is strict, private, non-ephemeral, non-distinct, has no operators, blocks SDK joins, and must contain exactly the two joined booking identities. The server unregisters all operators, removes unexpected members, joins missing expected members, and re-fetches before proceeding. It filters provider history to `MESG` from only those senders and exposes only minimized message DTOs.

Provider token authentication and restricted SDK access remain external legacy-defense prerequisites. The app fails closed unless both `SENDBIRD_TOKEN_AUTH_REQUIRED=true` and `SENDBIRD_RESTRICTED_ACL_REQUIRED=true`. Each deterministic channel must also carry the valid creation-time contract sealed by `SENDBIRD_CHANNEL_CONTRACT_SECRET`; an old or modified channel without that seal is rejected. Before upgrading, revoke legacy global-user tokens and migrate retained history from old generated channels into newly created deterministic channels; see `SETUP_GUIDE.md`.

## Abuse protection

The slot, checkout, booking-create, booking-mutation, and chat routes use a database-backed fixed-window limiter. Authenticated limits are keyed by the user UUID; public slot traffic is keyed by the trusted deployment network address. Chat additionally applies a coarse network gate before query/body parsing and authorization, then a principal gate after authorization. Its 15-second visible-page polling budget supports two continuously visible tabs with headroom for manual history loads. Send bodies are byte-bounded before JSON parsing. Identities are HMACed with `RATE_LIMIT_SECRET` before storage, and protected requests fail closed if the limiter is unavailable.

`GET /api/chat/channels?identityContext=household&bookingId=<uuid>[&beforeMessageId=<id>]`

Returns the latest 50 authorized text messages, or the 50 messages before `beforeMessageId`, in chronological order:

```json
{
  "data": {
    "messages": [
      { "id": "273778828", "text": "Bis morgen!", "createdAt": 1784707200000, "sender": "self" }
    ],
    "olderCursor": "273778828"
  }
}
```

`POST /api/chat/channels`

```json
{
  "identityContext": "household",
  "bookingId": "00000000-0000-4000-8000-000000000000",
  "message": "Bis morgen!",
  "clientMessageId": "d9902f8a-f108-486f-b001-56dd9345c009"
}
```

`message` is trimmed, text only, and limited to 2,000 characters. The client retains `clientMessageId` for retries of an unchanged draft; the server forwards it as Sendbird `dedup_id`, so an ambiguous transport retry does not create another provider message. The ID resets only after confirmed success or when the draft changes. Tutor requests use `identityContext=tutor`, require AAL2, and must match the booking's assigned tutor. Both methods re-authorize the live booking and apply database-backed per-user limits.

## Server integration locations

- Supabase clients and configuration: `src/lib/supabase`
- Stripe Checkout and fulfillment: `src/lib/stripe`, `src/lib/commerce`
- Cal.com API, HMAC verification, and reconciliation: `src/lib/calcom`
- Sendbird Platform API: `src/lib/sendbird/server.ts`
- Request schemas: `src/domain/*-schemas.ts`
- Public dashboard/credit DTOs: `src/domain/dashboard-dtos.ts`, `src/domain/credit-dtos.ts`

See `.env.example`, `SETUP_GUIDE.md`, and `supabase/README.md` for deployment and migration prerequisites.
