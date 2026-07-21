# Server API contract

All application mutations go through same-origin Next.js route handlers. Clients must send `Content-Type: application/json` for JSON bodies. Authenticated endpoints use the Supabase session cookie established by the SSR auth flow.

Successful responses use `{ "data": ... }`. Errors use:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe user-facing message"
  }
}
```

Provider credentials, Supabase service-role credentials, Cal.com booking UIDs, database user IDs, and Sendbird API tokens are never browser inputs or response fields.

## Public catalog

Tutor, subject, and package metadata comes from `src/domain/catalog.ts`. Stable tutor slugs, subject IDs, and package IDs are the only accepted public identifiers. Prices shown by the UI are catalog display data; the server derives package UUIDs and validates owned credits independently.

## Slots

`GET /api/slots?tutorSlug=<slug>&start=<ISO>&end=<ISO>&timeZone=<IANA>`

- Public, read-only endpoint.
- The requested interval must be valid and no longer than 62 days.
- The server resolves the tutor's event type and calls Cal.com v2.

## Bookings

`GET /api/bookings`

- Requires authentication.
- Parents receive their own bookings.
- Tutors receive bookings assigned to their mapped tutor record.
- Administrators receive all bookings for the explicit admin tutor view.
- Responses contain dashboard DTOs only; provider and ownership internals are redacted.

`POST /api/bookings`

- Requires an authenticated parent profile.
- Validates the strict JSON body with Zod; unknown fields are rejected.
- The contact email must equal the authenticated account email.
- Trial eligibility and paid credit ownership are checked before calling Cal.com and rechecked atomically when the booking is persisted.

Example body:

```json
{
  "tutorSlug": "mateo-mamaladze",
  "subjectId": "physics",
  "packageId": "trial",
  "startsAt": "2026-08-10T14:00:00.000Z",
  "timeZone": "Europe/Berlin",
  "location": "online",
  "contact": {
    "name": "Example Parent",
    "email": "parent@example.invalid"
  }
}
```

For a paid package, include the internal `packagePurchaseId` returned by `GET /api/packages`. The purchase must belong to the authenticated user, match the chosen package, be payment-verified and active, and have remaining credits.

`DELETE /api/bookings/:bookingId/cancel`

- Requires the booking owner, assigned tutor, or an administrator.
- The path parameter is the internal booking UUID, not a Cal.com UID.
- Cancels at Cal.com and then transactionally marks the database booking cancelled.
- Restores one paid credit exactly once; trials have no credit to restore.

Optional body:

```json
{ "reason": "Schedule changed" }
```

`PATCH /api/bookings/:bookingId/reschedule`

- Same authorization as cancellation.
- The new start must be in the future.
- The server derives the provider booking UID from the authorized database record.

```json
{
  "startsAt": "2026-08-12T15:00:00.000Z",
  "timeZone": "Europe/Berlin"
}
```

## Dashboard data

`GET /api/packages`

Returns only the authenticated user's verified package entitlements and remaining-credit counts.

`GET /api/profile`

Returns the authenticated role, display name, and mapped tutor slug where applicable. An account without a provisioned profile fails closed.

## Chat

`POST /api/chat/token`

Ensures the authenticated user exists in Sendbird and returns the app ID, opaque Sendbird user ID, and a short-lived session token. The Sendbird master API token never leaves the server.

`POST /api/chat/channels`

For a parent:

```json
{ "tutorSlug": "mateo-mamaladze" }
```

The server allows channel creation only when that parent has a booking with the tutor.

For a tutor:

```json
{
  "tutorSlug": "mateo-mamaladze",
  "bookingId": "00000000-0000-4000-8000-000000000000"
}
```

The tutor must be mapped to the slug and assigned to that booking. The server derives the parent identity and creates or retrieves the distinct one-to-one channel. Admin chat is intentionally disabled.

## Server integrations

- Supabase clients live under `src/lib/supabase`; service-role access is created per operation and only in server modules.
- Cal.com v2 integration lives under `src/lib/calcom`; event-type mapping comes from server environment configuration.
- Sendbird Platform API integration lives under `src/lib/sendbird/server.ts`.
- Runtime request validation lives in `src/domain/booking-schemas.ts`.
- Public response contracts live in `src/domain/dashboard-dtos.ts`.

See `.env.example`, `SETUP_GUIDE.md`, and `supabase/README.md` for deployment prerequisites.
