import { describe, expect, it } from 'vitest';
import {
  buildReconciliationObservation,
  followCalcomRescheduleChain,
  isCronRequestAuthorized,
  RECONCILIATION_AUDIT_BATCH_SIZE,
  RECONCILIATION_BATCH_SIZE,
  RECONCILIATION_URGENT_BATCH_SIZE,
  reconcileCalcomCandidates,
  targetLifecycleForSnapshot,
  type CalcomBookingSnapshot,
  type ReconciliationCandidate,
} from './reconciliation';

const candidate: ReconciliationCandidate = {
  id: '8bb08d6d-4bc1-4e5f-9ad8-673f78769341',
  provider_booking_id: 'cal-booking-1',
  lifecycle_status: 'scheduled',
  starts_at: '2030-05-05T09:00:00.000Z',
  ends_at: '2030-05-05T10:00:00.000Z',
  contact_email: 'parent@example.com',
  created_at: '2030-05-05T08:00:00.000Z',
  provider_last_synced_at: '2030-05-05T08:00:00.000Z',
  reconciliation_checked_at: null,
};

const activeSnapshot: CalcomBookingSnapshot = {
  uid: candidate.provider_booking_id!,
  status: 'accepted',
  startsAt: candidate.starts_at,
  endsAt: candidate.ends_at,
  durationMinutes: 60,
  meetingUrl: 'https://meet.example.invalid/private-token',
};

describe('cron authorization', () => {
  it('fails closed and requires the exact bearer value', () => {
    expect(isCronRequestAuthorized('Bearer undefined', undefined)).toBe(false);
    expect(isCronRequestAuthorized('Bearer ', '')).toBe(false);
    expect(isCronRequestAuthorized('Bearer secret ', 'secret')).toBe(false);
    expect(isCronRequestAuthorized('bearer secret', 'secret')).toBe(false);
    expect(isCronRequestAuthorized('Bearer local-random-value', 'local-random-value', false)).toBe(
      true,
    );
  });

  it('rejects public placeholders and weak production secrets', () => {
    expect(
      isCronRequestAuthorized(
        'Bearer GENERATE_A_LONG_RANDOM_SECRET',
        'GENERATE_A_LONG_RANDOM_SECRET',
        false,
      ),
    ).toBe(false);
    expect(isCronRequestAuthorized('Bearer short-but-random', 'short-but-random', true)).toBe(false);
    const productionSecret = 'z'.repeat(32);
    expect(isCronRequestAuthorized(`Bearer ${productionSecret}`, productionSecret, true)).toBe(true);
  });
});

describe('Cal.com snapshot mapping', () => {
  it('completes an accepted booking whose provider end is past', () => {
    expect(
      targetLifecycleForSnapshot(candidate, activeSnapshot, new Date('2030-05-05T10:01:00.000Z')),
    ).toBe('completed');
  });

  it('follows and validates a bounded multi-hop reschedule chain', async () => {
    const snapshots: Record<string, CalcomBookingSnapshot> = {
      'cal-booking-1': {
        ...activeSnapshot,
        status: 'cancelled',
        rescheduledToUid: 'replacement-1',
      },
      'replacement-1': {
        ...activeSnapshot,
        uid: 'replacement-1',
        status: 'cancelled',
        rescheduledFromUid: 'cal-booking-1',
        rescheduledToUid: 'replacement-2',
      },
      'replacement-2': {
        ...activeSnapshot,
        uid: 'replacement-2',
        rescheduledFromUid: 'replacement-1',
      },
    };

    const tail = await followCalcomRescheduleChain(
      'cal-booking-1',
      async (uid) => snapshots[uid],
    );
    expect(tail.uid).toBe('replacement-2');
    expect(tail.lineageRootUid).toBe('cal-booking-1');
    expect(tail.lineageFirstReplacementUid).toBe('replacement-1');
    expect(
      buildReconciliationObservation(
        candidate,
        tail,
        new Date('2030-05-05T08:01:00.000Z'),
      )?.providerBookingId,
    ).toBe('replacement-2');
  });

  it('treats a cancelled replacement tail as an authoritative cancellation', async () => {
    expect(
      targetLifecycleForSnapshot(
        { ...candidate, lifecycle_status: 'reschedule_pending' },
        {
          ...activeSnapshot,
          uid: 'replacement-2',
          status: 'cancelled',
          rescheduledFromUid: 'replacement-1',
          lineageRootUid: candidate.provider_booking_id,
        },
        new Date('2030-05-05T08:01:00.000Z'),
      ),
    ).toBe('cancelled');
  });

  it('rejects a broken or cyclic reschedule lineage', async () => {
    await expect(
      followCalcomRescheduleChain('cal-booking-1', async (uid) => ({
        ...activeSnapshot,
        uid,
        rescheduledFromUid: uid === 'replacement-1' ? 'unrelated' : null,
        rescheduledToUid: uid === 'cal-booking-1' ? 'replacement-1' : null,
      })),
    ).rejects.toThrow('lineage mismatch');

    await expect(
      followCalcomRescheduleChain('cal-booking-1', async (uid) => ({
        ...activeSnapshot,
        uid,
        rescheduledFromUid: uid === 'replacement-1' ? 'cal-booking-1' : 'replacement-1',
        rescheduledToUid: uid === 'cal-booking-1' ? 'replacement-1' : 'cal-booking-1',
      })),
    ).rejects.toThrow('cyclic or too deep');
  });

  it('does not mistake a cancelled old reschedule UID for a cancellation', () => {
    expect(
      targetLifecycleForSnapshot(
        { ...candidate, lifecycle_status: 'reschedule_pending' },
        { ...activeSnapshot, status: 'cancelled' },
        new Date('2030-05-05T08:00:00.000Z'),
      ),
    ).toBe('reschedule_pending');
  });

  it('keeps an unconfirmed provider booking pending', () => {
    expect(
      targetLifecycleForSnapshot(
        { ...candidate, lifecycle_status: 'provider_pending' },
        { ...activeSnapshot, status: 'pending' },
        new Date('2030-05-05T08:00:00.000Z'),
      ),
    ).toBe('pending_confirmation');
  });

  it('confirms a same-UID reschedule only after the provider start changes', () => {
    const pendingReschedule = { ...candidate, lifecycle_status: 'reschedule_pending' as const };
    expect(
      targetLifecycleForSnapshot(
        pendingReschedule,
        activeSnapshot,
        new Date('2030-05-05T08:00:00.000Z'),
      ),
    ).toBe('reschedule_pending');
    expect(
      targetLifecycleForSnapshot(
        pendingReschedule,
        {
          ...activeSnapshot,
          startsAt: '2030-05-06T09:00:00.000Z',
          endsAt: '2030-05-06T10:00:00.000Z',
        },
        new Date('2030-05-05T08:00:00.000Z'),
      ),
    ).toBe('scheduled');
  });

  it('builds a stable, sanitized synthetic event for an hourly window', () => {
    const first = buildReconciliationObservation(
      candidate,
      activeSnapshot,
      new Date('2030-05-05T08:01:00.000Z'),
    );
    const replay = buildReconciliationObservation(
      candidate,
      activeSnapshot,
      new Date('2030-05-05T08:59:00.000Z'),
    );

    expect(first?.providerEventId).toBe(replay?.providerEventId);
    expect(first?.payload).not.toHaveProperty('meetingUrl');
    expect(JSON.stringify(first?.payload)).not.toContain('private-token');
    expect(first?.meetingUrl).toBe(activeSnapshot.meetingUrl);
  });

  it('adopts the exact recovered provider UID for an ambiguous create', () => {
    const observation = buildReconciliationObservation(
      { ...candidate, provider_booking_id: null, lifecycle_status: 'provider_pending' },
      { ...activeSnapshot, uid: 'recovered-provider-uid' },
      new Date('2030-05-05T08:01:00.000Z'),
    );

    expect(observation?.providerBookingId).toBe('recovered-provider-uid');
    expect(observation?.payload.providerBookingId).toBe('recovered-provider-uid');
  });

  it('adopts a replacement UID only when provider lineage names the current UID', () => {
    const pending = { ...candidate, lifecycle_status: 'reschedule_pending' as const };
    const replacement = {
      ...activeSnapshot,
      uid: 'replacement-provider-uid',
      startsAt: '2030-05-07T09:00:00.000Z',
      endsAt: '2030-05-07T10:00:00.000Z',
      rescheduledFromUid: candidate.provider_booking_id,
    };

    expect(
      buildReconciliationObservation(pending, replacement, new Date('2030-05-05T08:01:00.000Z'))
        ?.providerBookingId,
    ).toBe('replacement-provider-uid');
    expect(
      buildReconciliationObservation(
        pending,
        { ...replacement, rescheduledFromUid: 'unrelated-uid' },
        new Date('2030-05-05T08:01:00.000Z'),
      ),
    ).toBeNull();
  });
});

describe('bounded reconciliation', () => {
  it('reserves part of every bounded batch for scheduled drift audits', () => {
    expect(RECONCILIATION_AUDIT_BATCH_SIZE).toBeGreaterThan(0);
    expect(RECONCILIATION_URGENT_BATCH_SIZE).toBeGreaterThan(0);
    expect(RECONCILIATION_URGENT_BATCH_SIZE + RECONCILIATION_AUDIT_BATCH_SIZE).toBe(
      RECONCILIATION_BATCH_SIZE,
    );
  });

  it('limits lookup concurrency and returns aggregate results only', async () => {
    const candidates = Array.from({ length: 7 }, (_, index) => ({
      ...candidate,
      id: `8bb08d6d-4bc1-4e5f-9ad8-673f7876934${index}`,
      provider_booking_id: `cal-booking-${index}`,
    }));
    let active = 0;
    let peak = 0;

    const counts = await reconcileCalcomCandidates(
      candidates,
      {
        fetchBooking: async (currentCandidate) => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 2));
          active -= 1;
          return { ...activeSnapshot, uid: currentCandidate.provider_booking_id! };
        },
        applyObservation: async () => ({ event_status: 'processed', replayed: false }),
      },
      new Date('2030-05-05T08:00:00.000Z'),
      2,
    );

    expect(peak).toBeLessThanOrEqual(2);
    expect(counts).toEqual({
      selected: 7,
      processed: 7,
      replayed: 0,
      ignored: 0,
      unresolved: 0,
      providerErrors: 0,
      rpcErrors: 0,
    });
    expect(JSON.stringify(counts)).not.toContain('cal-booking');
  });

  it('delegates a complete negative UID-less lookup to durable evidence recording', async () => {
    let resolutions = 0;
    const counts = await reconcileCalcomCandidates(
      [{
        ...candidate,
        provider_booking_id: null,
        lifecycle_status: 'provider_pending',
        created_at: '2030-05-03T07:00:00.000Z',
        reconciliation_checked_at: '2030-05-05T06:00:00.000Z',
      }],
      {
        fetchBooking: async () => null,
        resolveMissingCreate: async () => {
          resolutions += 1;
          return true;
        },
        applyObservation: async () => ({ event_status: 'processed', replayed: false }),
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(resolutions).toBe(1);
    expect(counts.processed).toBe(1);
    expect(counts.unresolved).toBe(0);
  });

  it('requires durable mutation evidence for an absent or cancelled source UID', async () => {
    const evidence: string[] = [];
    const pendingCancel = { ...candidate, lifecycle_status: 'cancellation_pending' as const };
    const pendingReschedule = { ...candidate, lifecycle_status: 'reschedule_pending' as const };
    const counts = await reconcileCalcomCandidates(
      [pendingCancel, pendingReschedule],
      {
        fetchBooking: async (current) =>
          current.lifecycle_status === 'cancellation_pending'
            ? null
            : { ...activeSnapshot, status: 'cancelled' },
        resolveMutationTerminalEvidence: async (_current, kind) => {
          evidence.push(kind);
          return kind === 'source_cancelled';
        },
        applyObservation: async () => {
          throw new Error('terminal mutation evidence must not be applied directly');
        },
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(evidence).toEqual(['source_absent', 'source_cancelled']);
    expect(counts.processed).toBe(1);
    expect(counts.unresolved).toBe(1);
    expect(counts.rpcErrors).toBe(0);
  });

  it('applies a staged external cancellation when no local mutation is live', async () => {
    let applied = 0;
    const counts = await reconcileCalcomCandidates(
      [{ ...candidate, lifecycle_status: 'cancellation_pending' }],
      {
        fetchBooking: async () => ({ ...activeSnapshot, status: 'cancelled' }),
        hasLiveMutationOperation: () => false,
        resolveMutationTerminalEvidence: async () => {
          throw new Error('no local mutation evidence should be recorded');
        },
        applyObservation: async () => {
          applied += 1;
          return { event_status: 'processed', replayed: false };
        },
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(applied).toBe(1);
    expect(counts.processed).toBe(1);
    expect(counts.rpcErrors).toBe(0);
  });

  it('records durable absence evidence for a staged external cancellation without an operation', async () => {
    const evidence: string[] = [];
    const counts = await reconcileCalcomCandidates(
      [{ ...candidate, lifecycle_status: 'cancellation_pending' }],
      {
        fetchBooking: async () => null,
        hasLiveMutationOperation: () => false,
        resolveMutationTerminalEvidence: async (_current, kind) => {
          evidence.push(kind);
          return true;
        },
        applyObservation: async () => {
          throw new Error('absence evidence must be settled by the durable RPC');
        },
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(evidence).toEqual(['source_absent']);
    expect(counts.processed).toBe(1);
    expect(counts.unresolved).toBe(0);
    expect(counts.rpcErrors).toBe(0);
  });

  it('requires durable same-UID active evidence before reversing a staged external cancellation', async () => {
    const evidence: string[] = [];
    let applied = 0;
    const counts = await reconcileCalcomCandidates(
      [{ ...candidate, lifecycle_status: 'cancellation_pending' }],
      {
        fetchBooking: async () => activeSnapshot,
        hasLiveMutationOperation: () => false,
        resolveMutationTerminalEvidence: async (_current, kind, snapshot) => {
          evidence.push(kind);
          expect(snapshot?.uid).toBe(candidate.provider_booking_id);
          return false;
        },
        applyObservation: async () => {
          applied += 1;
          return { event_status: 'processed', replayed: false };
        },
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(evidence).toEqual(['source_active']);
    expect(applied).toBe(0);
    expect(counts.unresolved).toBe(1);
    expect(counts.processed).toBe(0);
  });

  it('keeps pending provider evidence distinct from active evidence', async () => {
    const evidence: string[] = [];
    const counts = await reconcileCalcomCandidates(
      [{ ...candidate, lifecycle_status: 'cancellation_pending' }],
      {
        fetchBooking: async () => ({ ...activeSnapshot, status: 'pending' }),
        hasLiveMutationOperation: () => false,
        resolveMutationTerminalEvidence: async (_current, kind) => {
          evidence.push(kind);
          return true;
        },
        applyObservation: async () => {
          throw new Error('staged provider presence must use durable evidence');
        },
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(evidence).toEqual(['source_pending']);
    expect(counts.processed).toBe(1);
  });

  it('keeps user-initiated cancellation pending on an active same-UID snapshot', async () => {
    const observations: string[] = [];
    const counts = await reconcileCalcomCandidates(
      [{ ...candidate, lifecycle_status: 'cancellation_pending' }],
      {
        fetchBooking: async () => activeSnapshot,
        hasLiveMutationOperation: () => true,
        resolveMutationTerminalEvidence: async (_current, kind) => {
          observations.push(kind);
          return false;
        },
        applyObservation: async (observation) => {
          expect(observation.targetLifecycle).toBe('cancellation_pending');
          return { event_status: 'processed', replayed: false };
        },
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(observations).toEqual([]);
    expect(counts.processed).toBe(1);
  });

  it('keeps a UID-less create unresolved when durable evidence is insufficient', async () => {
    let resolutions = 0;
    const counts = await reconcileCalcomCandidates(
      [{
        ...candidate,
        provider_booking_id: null,
        lifecycle_status: 'provider_pending',
        reconciliation_checked_at: '2030-05-05T07:30:00.000Z',
      }],
      {
        fetchBooking: async () => null,
        resolveMissingCreate: async () => {
          resolutions += 1;
          return false;
        },
        applyObservation: async () => ({ event_status: 'processed', replayed: false }),
      },
      new Date('2030-05-05T08:00:00.000Z'),
    );

    expect(resolutions).toBe(1);
    expect(counts.unresolved).toBe(1);
  });
});
