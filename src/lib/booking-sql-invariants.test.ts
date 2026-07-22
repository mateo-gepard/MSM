import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TUTOR_ID = '65af49a0-33dc-5a71-9000-000000000001';
const TRIAL_PACKAGE_ID = 'a497cc91-10a1-5ac1-9000-000000000001';

type Reservation = {
  booking_id: string;
  operation_id: string;
  operation_status: string;
  lifecycle_status: string;
  starts_at: string;
  replayed: boolean;
};

type Operation = {
  booking_id: string;
  operation_id: string;
  operation_status: string;
  replayed: boolean;
};

let database: PGlite;

async function value<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await database.query<{ value: T }>(sql, params);
  return result.rows[0].value;
}

async function createHouseholdUser(index: number) {
  const userId = `10000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
  const email = `parent${index}@example.test`;
  await database.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1::uuid, $2::text, jsonb_build_object('name', $3::text))`,
    [userId, email, `Parent ${index}`],
  );
  const householdId = await value<string>(
    `select primary_household_id as value from public.profiles where id = $1::uuid`,
    [userId],
  );
  const learnerId = await value<string>(
    `insert into public.learners (household_id, display_name, created_by_user_id)
     values ($1::uuid, $2::text, $3::uuid)
     returning id as value`,
    [householdId, `Learner ${index}`, userId],
  );
  return { userId, householdId, learnerId, email };
}

async function reserve(
  principal: Awaited<ReturnType<typeof createHouseholdUser>>,
  startsAt: string,
  idempotencyKey: string,
) {
  return value<Reservation>(
    `select public.reserve_booking_credit(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, null::uuid,
       'math', $6::timestamptz, 60, 'Europe/Berlin', 'online', null,
       $7::text, $8::text, null, null, $9::text
     ) as value`,
    [
      principal.userId,
      principal.householdId,
      principal.learnerId,
      TUTOR_ID,
      TRIAL_PACKAGE_ID,
      startsAt,
      `Parent ${principal.userId.slice(-1)}`,
      principal.email,
      idempotencyKey,
    ],
  );
}

async function confirm(reservation: Reservation, startsAt: string, providerUid: string) {
  await value<boolean>(
    `select public.claim_booking_operation($1::uuid, $2::uuid) as value`,
    [reservation.booking_id, reservation.operation_id],
  );
  await value(
    `select public.confirm_booking_credit(
       $1::uuid, $2::uuid, $3::text, 1001, $4::timestamptz,
       $4::timestamptz + interval '1 hour', 'scheduled', null,
       jsonb_build_object('uid', $3::text)
     ) as value`,
    [reservation.booking_id, reservation.operation_id, providerUid, startsAt],
  );
}

async function beginReschedule(
  bookingId: string,
  userId: string,
  startsAt: string,
  idempotencyKey: string,
) {
  return value<Operation>(
    `select public.begin_booking_operation(
       $1::uuid, $2::uuid, 'reschedule', $3::text, $4::timestamptz,
       'Europe/Berlin', 'Integration test'
     ) as value`,
    [bookingId, userId, idempotencyKey, startsAt],
  );
}

async function activeHoldCount(operationId: string) {
  return value<number>(
    `select count(*)::integer as value
     from public.booking_slot_claims
     where operation_id = $1::uuid
       and claim_kind = 'reschedule_hold'
       and released_at is null`,
    [operationId],
  );
}

describe('booking SQL reliability invariants', () => {
  beforeAll(async () => {
    database = new PGlite({ extensions: { btree_gist } });
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb
      );
      create function auth.uid() returns uuid
        language sql stable as 'select null::uuid';
      create function auth.jwt() returns jsonb
        language sql stable as 'select jsonb_build_object(''aal'', ''aal2'')';
      -- PGlite does not bundle pgcrypto. This compile-only substitute preserves
      -- the byte length needed by code paths unrelated to these booking tests.
      create function public.digest(value text, algorithm text) returns bytea
        language sql immutable
        as 'select decode(md5(value) || md5(value), ''hex'')';
    `);

    for (const relativePath of [
      '../../supabase/migrations/20260721000100_backend_foundation.sql',
      '../../supabase/migrations/20260721000200_msm_households_payments_ledger.sql',
    ]) {
      const migrationUrl = new URL(relativePath, import.meta.url);
      const migration = (await readFile(migrationUrl, 'utf8')).replace(
        'create extension if not exists pgcrypto;',
        '',
      );
      await database.exec(migration);
    }
  }, 30_000);

  afterAll(async () => {
    await database?.close();
  });

  it('keeps create replays stable and serializes target holds through every settlement', async () => {
    const principals = await Promise.all([
      createHouseholdUser(1),
      createHouseholdUser(2),
      createHouseholdUser(3),
      createHouseholdUser(4),
    ]);
    const sourceStarts = [
      '2099-01-10T09:00:00Z',
      '2099-01-10T11:00:00Z',
      '2099-01-11T09:00:00Z',
      '2099-01-11T11:00:00Z',
    ];
    const createKeys = [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004',
    ];
    const reservations: Reservation[] = [];
    for (let index = 0; index < principals.length; index += 1) {
      const reservation = await reserve(principals[index], sourceStarts[index], createKeys[index]);
      await confirm(reservation, sourceStarts[index], `cal-booking-${index + 1}`);
      reservations.push(reservation);
    }

    const contestedTarget = '2099-02-01T10:00:00Z';
    const concurrent = await Promise.allSettled([
      beginReschedule(
        reservations[0].booking_id,
        principals[0].userId,
        contestedTarget,
        '30000000-0000-4000-8000-000000000001',
      ),
      beginReschedule(
        reservations[1].booking_id,
        principals[1].userId,
        contestedTarget,
        '30000000-0000-4000-8000-000000000002',
      ),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejected = concurrent.find((result) => result.status === 'rejected');
    expect(String(rejected && rejected.status === 'rejected' ? rejected.reason : '')).toMatch(
      /conflicting key value violates exclusion constraint|booking_slot_claims_no_overlap/,
    );

    const winnerIndex = concurrent[0].status === 'fulfilled' ? 0 : 1;
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    const winnerOperation = concurrent[winnerIndex];
    if (winnerOperation.status !== 'fulfilled') throw new Error('Expected one reschedule winner');
    expect(await activeHoldCount(winnerOperation.value.operation_id)).toBe(1);

    await value<boolean>(
      `select public.claim_booking_operation($1::uuid, $2::uuid) as value`,
      [winnerOperation.value.booking_id, winnerOperation.value.operation_id],
    );
    await value(
      `select public.fail_booking_operation($1::uuid, true, 'PROVIDER_AMBIGUOUS', null) as value`,
      [winnerOperation.value.operation_id],
    );
    expect(await activeHoldCount(winnerOperation.value.operation_id)).toBe(1);

    const unchangedSnapshot = await value<{ event_status: string }>(
      `select public.process_provider_booking_event(
         'calcom', $1::text, 'RECONCILIATION_SNAPSHOT', $2::uuid, $3::text, now(),
         'reschedule_pending', $4::timestamptz,
         $4::timestamptz + interval '1 hour', 'scheduled', null,
         jsonb_build_object('source', 'test'), null
       ) as value`,
      [
        `unchanged-${winnerOperation.value.operation_id}`,
        winnerOperation.value.booking_id,
        `cal-booking-${winnerIndex + 1}`,
        sourceStarts[winnerIndex],
      ],
    );
    expect(unchangedSnapshot.event_status).toBe('processed');
    expect(await activeHoldCount(winnerOperation.value.operation_id)).toBe(1);

    await value(
      `select public.complete_booking_operation(
         $1::uuid, $2::text, $3::timestamptz, $3::timestamptz + interval '1 hour',
         'scheduled', null, jsonb_build_object('uid', $2::text)
       ) as value`,
      [winnerOperation.value.operation_id, 'cal-booking-rescheduled', contestedTarget],
    );
    expect(await activeHoldCount(winnerOperation.value.operation_id)).toBe(0);
    expect(
      await value<number>(
        `select count(*)::integer as value
         from public.booking_slot_claims
         where booking_id = $1::uuid and claim_kind = 'booking'
           and starts_at = $2::timestamptz and released_at is null`,
        [winnerOperation.value.booking_id, contestedTarget],
      ),
    ).toBe(1);

    const createReplay = await reserve(
      principals[winnerIndex],
      sourceStarts[winnerIndex],
      createKeys[winnerIndex],
    );
    expect(createReplay.replayed).toBe(true);
    expect(new Date(createReplay.starts_at).toISOString()).toBe(
      new Date(contestedTarget).toISOString(),
    );
    await expect(
      reserve(
        principals[winnerIndex],
        '2099-01-20T09:00:00Z',
        createKeys[winnerIndex],
      ),
    ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED/);

    const deterministicTarget = '2099-02-02T10:00:00Z';
    const deterministicOperation = await beginReschedule(
      reservations[loserIndex].booking_id,
      principals[loserIndex].userId,
      deterministicTarget,
      '30000000-0000-4000-8000-000000000003',
    );
    await value<boolean>(
      `select public.claim_booking_operation($1::uuid, $2::uuid) as value`,
      [deterministicOperation.booking_id, deterministicOperation.operation_id],
    );
    await value(
      `select public.fail_booking_operation($1::uuid, false, 'SLOT_UNAVAILABLE', null) as value`,
      [deterministicOperation.operation_id],
    );
    expect(await activeHoldCount(deterministicOperation.operation_id)).toBe(0);
    const replacementHold = await beginReschedule(
      reservations[3].booking_id,
      principals[3].userId,
      deterministicTarget,
      '30000000-0000-4000-8000-000000000004',
    );
    expect(await activeHoldCount(replacementHold.operation_id)).toBe(1);

    const reconciledTarget = '2099-02-03T10:00:00Z';
    const reconciledOperation = await beginReschedule(
      reservations[2].booking_id,
      principals[2].userId,
      reconciledTarget,
      '30000000-0000-4000-8000-000000000005',
    );
    await value<boolean>(
      `select public.claim_booking_operation($1::uuid, $2::uuid) as value`,
      [reconciledOperation.booking_id, reconciledOperation.operation_id],
    );
    await value(
      `select public.fail_booking_operation($1::uuid, true, 'PROVIDER_AMBIGUOUS', null) as value`,
      [reconciledOperation.operation_id],
    );
    const reconciled = await value<{ event_status: string; lifecycle_status: string }>(
      `select public.process_provider_booking_event(
         'calcom', $1::text, 'BOOKING_RESCHEDULED', $2::uuid, $3::text,
         now() + interval '1 second', 'scheduled', $4::timestamptz,
         $4::timestamptz + interval '1 hour', 'scheduled', null,
         jsonb_build_object('rescheduledFromUid', $5::text), null
       ) as value`,
      [
        `rescheduled-${reconciledOperation.operation_id}`,
        reconciledOperation.booking_id,
        'cal-booking-3-replacement',
        reconciledTarget,
        'cal-booking-3',
      ],
    );
    expect(reconciled).toMatchObject({ event_status: 'processed', lifecycle_status: 'scheduled' });
    expect(await activeHoldCount(reconciledOperation.operation_id)).toBe(0);

    await expect(
      database.query(
        `insert into public.booking_slot_claims (
           booking_id, operation_id, tutor_id, starts_at, ends_at, claim_kind
         ) values (
           $1::uuid, $2::uuid, $3::uuid, $4::timestamptz,
           $4::timestamptz + interval '1 hour', 'booking'
         )`,
        [
          reservations[2].booking_id,
          reconciledOperation.operation_id,
          TUTOR_ID,
          '2099-03-01T10:00:00Z',
        ],
      ),
    ).rejects.toThrow();
  }, 30_000);
});
