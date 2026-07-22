import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { isAcceptableSharedSecret } from '@/lib/calcom/config';
import { assertServerOnly } from '@/lib/security/server-only';

assertServerOnly('Cal.com booking reconciliation');

export const RECONCILIATION_BATCH_SIZE = 20;
export const RECONCILIATION_URGENT_BATCH_SIZE = 15;
export const RECONCILIATION_AUDIT_BATCH_SIZE =
  RECONCILIATION_BATCH_SIZE - RECONCILIATION_URGENT_BATCH_SIZE;
export const RECONCILIATION_CONCURRENCY = 5;

const bookingLifecycleSchema = z.enum([
  'provider_pending',
  'pending_confirmation',
  'scheduled',
  'completed',
  'cancellation_pending',
  'reschedule_pending',
  'cancelled',
  'failed',
]);

const instantSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Expected a valid instant',
);

export const reconciliationCandidateSchema = z.object({
  id: z.uuid(),
  provider_booking_id: z.string().trim().min(1).nullable(),
  lifecycle_status: bookingLifecycleSchema,
  starts_at: instantSchema,
  ends_at: instantSchema,
  contact_email: z.string().trim().email(),
  created_at: instantSchema,
  provider_last_synced_at: instantSchema.nullable(),
  reconciliation_checked_at: instantSchema.nullable(),
});

export const reconciliationCandidatesSchema = z.array(reconciliationCandidateSchema);

export const providerEventResultSchema = z.object({
  event_status: z.string().min(1),
  replayed: z.boolean().optional().default(false),
});

export type BookingLifecycle = z.infer<typeof bookingLifecycleSchema>;
export type ReconciliationCandidate = z.infer<typeof reconciliationCandidateSchema>;

export interface CalcomBookingSnapshot {
  uid: string;
  status: string | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  meetingUrl: string | null;
  rescheduledFromUid?: string | null;
  rescheduledToUid?: string | null;
  lineageRootUid?: string | null;
  lineageFirstReplacementUid?: string | null;
  lineageFirstReplacementStartsAt?: string | null;
  lineageFirstReplacementEndsAt?: string | null;
}

export interface ReconciliationObservation {
  providerEventId: string;
  eventType: 'RECONCILIATION_SNAPSHOT';
  bookingId: string;
  providerBookingId: string;
  occurredAt: string;
  targetLifecycle: BookingLifecycle;
  providerStartsAt: string | null;
  providerEndsAt: string | null;
  providerStatus: string | null;
  meetingUrl: string | null;
  payload: Record<string, string | number | null>;
  payloadSha256: string;
}

export interface ReconciliationCounts {
  selected: number;
  processed: number;
  replayed: number;
  ignored: number;
  unresolved: number;
  providerErrors: number;
  rpcErrors: number;
}

interface ReconciliationDependencies {
  fetchBooking: (candidate: ReconciliationCandidate) => Promise<CalcomBookingSnapshot | null>;
  resolveMissingCreate?: (candidate: ReconciliationCandidate) => Promise<boolean>;
  resolveMutationTerminalEvidence?: (
    candidate: ReconciliationCandidate,
    evidence: 'source_absent' | 'source_cancelled' | 'source_active' | 'source_pending',
    snapshot?: CalcomBookingSnapshot,
  ) => Promise<boolean>;
  hasLiveMutationOperation?: (candidate: ReconciliationCandidate) => boolean;
  applyObservation: (
    observation: ReconciliationObservation,
  ) => Promise<z.infer<typeof providerEventResultSchema>>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function validInstant(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function normalizedProviderStatus(value: string | null): string {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
}

const PENDING_PROVIDER_STATUSES = new Set([
  'pending',
  'pending_confirmation',
  'requested',
  'unconfirmed',
  'awaiting_host',
]);
const ACTIVE_PROVIDER_STATUSES = new Set(['accepted', 'confirmed', 'scheduled', 'booked']);

function isPast(value: string | null, observedAt: Date): boolean {
  return value !== null && new Date(value).getTime() <= observedAt.getTime();
}

export async function followCalcomRescheduleChain(
  initialUid: string,
  fetchBooking: (uid: string) => Promise<CalcomBookingSnapshot>,
  maxHops = 5,
): Promise<CalcomBookingSnapshot> {
  if (!initialUid.trim() || !Number.isInteger(maxHops) || maxHops < 1 || maxHops > 20) {
    throw new Error('Invalid Cal.com reschedule traversal');
  }

  let current = await fetchBooking(initialUid);
  if (current.uid !== initialUid) throw new Error('Cal.com booking identity mismatch');
  const visited = new Set([current.uid]);
  let firstReplacement: CalcomBookingSnapshot | null = null;

  for (let hop = 0; current.rescheduledToUid; hop += 1) {
    if (hop >= maxHops || visited.has(current.rescheduledToUid)) {
      throw new Error('Cal.com reschedule chain is cyclic or too deep');
    }
    const expectedUid = current.rescheduledToUid;
    const replacement = await fetchBooking(expectedUid);
    if (replacement.uid !== expectedUid || replacement.rescheduledFromUid !== current.uid) {
      throw new Error('Cal.com reschedule lineage mismatch');
    }
    firstReplacement ??= replacement;
    visited.add(replacement.uid);
    current = replacement;
  }

  return current.uid === initialUid
    ? current
    : {
        ...current,
        lineageRootUid: initialUid,
        lineageFirstReplacementUid: firstReplacement?.uid ?? null,
        lineageFirstReplacementStartsAt: firstReplacement?.startsAt ?? null,
        lineageFirstReplacementEndsAt: firstReplacement?.endsAt ?? null,
      };
}

export function isCronRequestAuthorized(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
  production = process.env.NODE_ENV === 'production',
): boolean {
  if (!isAcceptableSharedSecret(cronSecret, production)) return false;
  const candidateDigest = createHash('sha256').update(authorizationHeader ?? '').digest();
  const expectedDigest = createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export function targetLifecycleForSnapshot(
  candidate: ReconciliationCandidate,
  snapshot: CalcomBookingSnapshot,
  observedAt: Date,
): BookingLifecycle | null {
  if (candidate.lifecycle_status === 'cancelled' || candidate.lifecycle_status === 'completed') {
    return candidate.lifecycle_status;
  }
  if (candidate.lifecycle_status === 'failed') return 'failed';

  const status = normalizedProviderStatus(snapshot.status);
  const cancelled = status === 'cancelled' || status === 'canceled' || status === 'rejected';
  const completed = status === 'completed';
  const pending = PENDING_PROVIDER_STATUSES.has(status);
  const active = ACTIVE_PROVIDER_STATUSES.has(status);
  const lineageReplacement = Boolean(
    candidate.provider_booking_id &&
    snapshot.uid !== candidate.provider_booking_id &&
    (snapshot.lineageRootUid ?? snapshot.rescheduledFromUid) === candidate.provider_booking_id,
  );

  // A cancelled old UID can mean Cal.com created a replacement UID during a
  // reschedule. Without that replacement UID, cancellation must not be inferred.
  if (candidate.lifecycle_status === 'reschedule_pending' && cancelled && !lineageReplacement) {
    return 'reschedule_pending';
  }
  if (cancelled) return 'cancelled';
  if (completed) return 'completed';

  if (candidate.lifecycle_status === 'cancellation_pending' && !lineageReplacement) {
    return pending || active ? 'cancellation_pending' : null;
  }
  if (candidate.lifecycle_status === 'reschedule_pending') {
    if (!pending && !active) return null;
    const providerStart = validInstant(snapshot.startsAt);
    const currentStart = validInstant(candidate.starts_at);
    if (!providerStart || providerStart === currentStart) return 'reschedule_pending';
    if (pending) return 'pending_confirmation';
    const providerEnd = validInstant(snapshot.endsAt);
    return isPast(providerEnd, observedAt) ? 'completed' : 'scheduled';
  }

  if (pending) return 'pending_confirmation';
  if (!active) return null;

  const providerEnd = validInstant(snapshot.endsAt);
  const effectiveEnd = providerEnd ?? validInstant(candidate.ends_at);
  return isPast(effectiveEnd, observedAt) ? 'completed' : 'scheduled';
}

export function buildReconciliationObservation(
  candidate: ReconciliationCandidate,
  snapshot: CalcomBookingSnapshot,
  observedAt: Date,
): ReconciliationObservation | null {
  if (
    (
      candidate.provider_booking_id !== null &&
      snapshot.uid !== candidate.provider_booking_id &&
      (snapshot.lineageRootUid ?? snapshot.rescheduledFromUid) !== candidate.provider_booking_id
    ) ||
    Number.isNaN(observedAt.getTime())
  ) return null;

  const targetLifecycle = targetLifecycleForSnapshot(candidate, snapshot, observedAt);
  if (!targetLifecycle) return null;

  const providerStartsAt = validInstant(snapshot.startsAt);
  const parsedProviderEnd = validInstant(snapshot.endsAt);
  const providerEndsAt = providerStartsAt ? parsedProviderEnd : null;
  const providerStatus = snapshot.status?.trim().slice(0, 100) || null;
  const observationWindow = new Date(
    Math.floor(observedAt.getTime() / 3_600_000) * 3_600_000,
  ).toISOString();
  const meetingUrlFingerprint = snapshot.meetingUrl ? sha256(snapshot.meetingUrl) : null;
  const payload: ReconciliationObservation['payload'] = {
    schemaVersion: 1,
    source: 'cron_reconciliation',
    observationWindow,
    bookingId: candidate.id,
    providerBookingId: snapshot.uid,
    providerStatus,
    targetLifecycle,
    startsAt: providerStartsAt,
    endsAt: providerEndsAt,
    meetingUrlFingerprint,
    rescheduledFromUid: snapshot.lineageRootUid ?? snapshot.rescheduledFromUid ?? null,
    lineageFirstReplacementUid: snapshot.lineageFirstReplacementUid ?? null,
    lineageFirstReplacementStartsAt: validInstant(
      snapshot.lineageFirstReplacementStartsAt ?? null,
    ),
    lineageFirstReplacementEndsAt: validInstant(
      snapshot.lineageFirstReplacementEndsAt ?? null,
    ),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadSha256 = sha256(payloadJson);

  return {
    providerEventId: `reconcile:v1:${payloadSha256}`,
    eventType: 'RECONCILIATION_SNAPSHOT',
    bookingId: candidate.id,
    providerBookingId: snapshot.uid,
    occurredAt: observedAt.toISOString(),
    targetLifecycle,
    providerStartsAt,
    providerEndsAt,
    providerStatus,
    meetingUrl: snapshot.meetingUrl?.trim().slice(0, 2_000) || null,
    payload,
    payloadSha256,
  };
}

export async function reconcileCalcomCandidates(
  candidates: ReconciliationCandidate[],
  dependencies: ReconciliationDependencies,
  observedAt = new Date(),
  concurrency = RECONCILIATION_CONCURRENCY,
): Promise<ReconciliationCounts> {
  const counts: ReconciliationCounts = {
    selected: candidates.length,
    processed: 0,
    replayed: 0,
    ignored: 0,
    unresolved: 0,
    providerErrors: 0,
    rpcErrors: 0,
  };
  if (candidates.length === 0) return counts;

  let nextIndex = 0;
  const workerCount = Math.min(
    candidates.length,
    Math.max(1, Math.min(10, Math.floor(concurrency) || 1)),
  );

  const worker = async () => {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex++];
      let snapshot: CalcomBookingSnapshot | null;
      try {
        snapshot = await dependencies.fetchBooking(candidate);
      } catch {
        counts.providerErrors += 1;
        continue;
      }
      if (!snapshot) {
        if (
          dependencies.resolveMissingCreate &&
          candidate.provider_booking_id === null &&
          candidate.lifecycle_status === 'provider_pending'
        ) {
          try {
            if (await dependencies.resolveMissingCreate(candidate)) {
              counts.processed += 1;
              continue;
            }
          } catch {
            counts.rpcErrors += 1;
            continue;
          }
        } else if (
          dependencies.resolveMutationTerminalEvidence &&
          candidate.provider_booking_id !== null &&
          (
            candidate.lifecycle_status === 'cancellation_pending' ||
            (
              candidate.lifecycle_status === 'reschedule_pending' &&
              (dependencies.hasLiveMutationOperation?.(candidate) ?? true)
            )
          )
        ) {
          try {
            if (await dependencies.resolveMutationTerminalEvidence(candidate, 'source_absent')) {
              counts.processed += 1;
            } else {
              counts.unresolved += 1;
            }
          } catch {
            counts.rpcErrors += 1;
          }
          continue;
        }
        counts.unresolved += 1;
        continue;
      }

      const snapshotStatus = normalizedProviderStatus(snapshot.status);
      const sourceCancelled = ['cancelled', 'canceled', 'rejected'].includes(snapshotStatus);
      const hasLineageReplacement = Boolean(
        candidate.provider_booking_id &&
        snapshot.uid !== candidate.provider_booking_id &&
        (snapshot.lineageRootUid ?? snapshot.rescheduledFromUid) ===
          candidate.provider_booking_id,
      );
      const hasLiveMutationOperation =
        dependencies.hasLiveMutationOperation?.(candidate) ?? true;
      if (
        dependencies.resolveMutationTerminalEvidence &&
        hasLiveMutationOperation &&
        candidate.provider_booking_id !== null &&
        (candidate.lifecycle_status === 'cancellation_pending' ||
          candidate.lifecycle_status === 'reschedule_pending') &&
        sourceCancelled &&
        !hasLineageReplacement
      ) {
        try {
          if (await dependencies.resolveMutationTerminalEvidence(candidate, 'source_cancelled')) {
            counts.processed += 1;
          } else {
            counts.unresolved += 1;
          }
        } catch {
          counts.rpcErrors += 1;
        }
        continue;
      }

      const stagedCancellationPresenceEvidence =
        !hasLiveMutationOperation &&
        candidate.lifecycle_status === 'cancellation_pending' &&
        candidate.provider_booking_id !== null &&
        snapshot.uid === candidate.provider_booking_id &&
        !snapshot.rescheduledToUid &&
        (ACTIVE_PROVIDER_STATUSES.has(snapshotStatus)
          ? 'source_active'
          : PENDING_PROVIDER_STATUSES.has(snapshotStatus)
            ? 'source_pending'
            : null);
      if (
        dependencies.resolveMutationTerminalEvidence &&
        stagedCancellationPresenceEvidence
      ) {
        try {
          if (
            await dependencies.resolveMutationTerminalEvidence(
              candidate,
              stagedCancellationPresenceEvidence,
              snapshot,
            )
          ) {
            counts.processed += 1;
          } else {
            counts.unresolved += 1;
          }
        } catch {
          counts.rpcErrors += 1;
        }
        continue;
      }

      const observation = buildReconciliationObservation(candidate, snapshot, observedAt);
      if (!observation) {
        counts.unresolved += 1;
        continue;
      }

      try {
        const result = await dependencies.applyObservation(observation);
        if (result.replayed) counts.replayed += 1;
        else if (result.event_status === 'processed') counts.processed += 1;
        else if (result.event_status === 'ignored') counts.ignored += 1;
        else counts.rpcErrors += 1;
      } catch {
        counts.rpcErrors += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return counts;
}
