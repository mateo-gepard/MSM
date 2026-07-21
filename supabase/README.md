# Database migrations

Apply `supabase/migrations` with the Supabase CLI in order. The foundation migration is safe to run on a fresh project.

## Existing database compatibility

The former hand-written schema used incompatible numeric tutor IDs and split booking dates/times. The migration preserves those tables as `tutors_legacy_20260721`, `bookings_legacy_20260721`, and `package_purchases_legacy_20260721` instead of guessing at financial or provider data. Export and reconcile those rows against the canonical tutor UUIDs before a reviewed import, then remove the legacy tables in a later migration. Do not mark old purchases as `payment_status = 'verified'` without evidence from the payment provider.
