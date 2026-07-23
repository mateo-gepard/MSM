import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import {
  RECONCILIATION_AUDIT_BATCH_SIZE,
  RECONCILIATION_BATCH_SIZE,
  RECONCILIATION_URGENT_BATCH_SIZE,
  followCalcomRescheduleChain,
  isCronRequestAuthorized,
  providerEventResultSchema,
  reconciliationCandidatesSchema,
  reconcileCalcomCandidates,
} from '@/lib/calcom/reconciliation';
import {
  CalcomApiError,
  findCalcomBookingByInternalId,
  findCalcomBookingLineageByInternalId,
  getCalcomBooking,
} from '@/lib/calcom/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

// `vercel.json` uses a Hobby-compatible daily safety-net schedule. Signed
// webhooks remain the primary synchronization path. Production environments
// with a tighter repair SLO can invoke this authenticated route hourly from a
// Vercel Pro cron or an equivalent external scheduler.
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new NextResponse(null, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    const service = createSupabaseServiceClient();
    const observedAt = new Date();
    const observedAtIso = observedAt.toISOString();
    const rateLimitRetentionCutoff = new Date(
      observedAt.getTime() - 48 * 60 * 60 * 1_000,
    ).toISOString();
    const { error: rateLimitCleanupError } = await service
      .from('api_rate_limit_buckets')
      .delete()
      .lt('updated_at', rateLimitRetentionCutoff);
    const filter = [
      'sync_status.in.(pending,needs_reconciliation)',
      'lifecycle_status.in.(provider_pending,pending_confirmation,cancellation_pending,reschedule_pending)',
      `and(lifecycle_status.eq.scheduled,ends_at.lte.${observedAtIso})`,
    ].join(',');
    const candidateColumns =
      'id,provider_booking_id,lifecycle_status,starts_at,ends_at,contact_email,created_at,provider_last_synced_at,reconciliation_checked_at';

    const { data: urgentData, error: urgentError } = await service
      .from('bookings')
      .select(candidateColumns)
      .eq('scheduling_provider', 'calcom')
      .or(filter)
      .order('reconciliation_checked_at', { ascending: true, nullsFirst: true })
      .order('updated_at', { ascending: true })
      .limit(RECONCILIATION_URGENT_BATCH_SIZE);

    if (urgentError) {
      throw new ApiError(503, 'RECONCILIATION_QUERY_FAILED', 'Booking reconciliation is unavailable.');
    }

    // Audit capacity is independent of the urgent queue. Without a reserved
    // slice, a sustained pending backlog can starve the six-hour drift audit.
    const auditCutoff = new Date(observedAt.getTime() - 6 * 60 * 60 * 1_000).toISOString();
    const auditHorizon = new Date(observedAt.getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString();
    const { data: auditData, error: auditError } = await service
      .from('bookings')
      .select(candidateColumns)
      .eq('scheduling_provider', 'calcom')
      .eq('lifecycle_status', 'scheduled')
      .eq('sync_status', 'in_sync')
      .not('provider_booking_id', 'is', null)
      .gt('starts_at', observedAtIso)
      .lte('starts_at', auditHorizon)
      .or(`reconciliation_checked_at.is.null,reconciliation_checked_at.lte.${auditCutoff}`)
      .order('reconciliation_checked_at', { ascending: true, nullsFirst: true })
      .order('starts_at', { ascending: true })
      .limit(RECONCILIATION_AUDIT_BATCH_SIZE);
    if (auditError) {
      throw new ApiError(503, 'RECONCILIATION_QUERY_FAILED', 'Booking reconciliation is unavailable.');
    }
    const candidateRows = [...(urgentData ?? []), ...(auditData ?? [])];

    const parsedCandidates = reconciliationCandidatesSchema.safeParse(candidateRows);
    if (!parsedCandidates.success) {
      throw new ApiError(503, 'RECONCILIATION_DATA_INVALID', 'Booking reconciliation is unavailable.');
    }

    const candidateIds = parsedCandidates.data.map((candidate) => candidate.id);
    const createStartedAtByBooking = new Map<string, string | null>();
    const liveOperationByBooking = new Map<
      string,
      {
        operation_type: 'create' | 'reschedule' | 'cancel' | 'reconcile';
        started_at: string | null;
      }
    >();
    if (candidateIds.length > 0) {
      const { data: liveOperations, error: operationError } = await service
        .from('booking_operations')
        .select('booking_id,operation_type,started_at')
        .in('booking_id', candidateIds)
        .in('status', ['queued', 'processing', 'ambiguous']);
      if (operationError) {
        throw new ApiError(503, 'RECONCILIATION_QUERY_FAILED', 'Booking reconciliation is unavailable.');
      }
      for (const operation of liveOperations ?? []) {
        if (liveOperationByBooking.has(operation.booking_id)) {
          throw new ApiError(503, 'RECONCILIATION_DATA_INVALID', 'Booking reconciliation is unavailable.');
        }
        liveOperationByBooking.set(operation.booking_id, operation);
        if (operation.operation_type === 'create') {
          createStartedAtByBooking.set(operation.booking_id, operation.started_at);
        }
      }
    }

    if (parsedCandidates.data.length > 0) {
      const { error: markCheckedError } = await service
        .from('bookings')
        .update({ reconciliation_checked_at: observedAtIso })
        .in('id', parsedCandidates.data.map((candidate) => candidate.id));
      if (markCheckedError) {
        throw new ApiError(503, 'RECONCILIATION_QUEUE_FAILED', 'Booking reconciliation is unavailable.');
      }
    }

    const counts = await reconcileCalcomCandidates(
      parsedCandidates.data,
      {
        fetchBooking: async (candidate) => {
          if (!candidate.provider_booking_id) {
            if (!createStartedAtByBooking.has(candidate.id)) {
              throw new Error('Live create operation is missing');
            }
            return findCalcomBookingByInternalId({
              internalBookingId: candidate.id,
              attendeeEmail: candidate.contact_email,
              createdAt: createStartedAtByBooking.get(candidate.id) ?? candidate.created_at,
            });
          }

          try {
            return await followCalcomRescheduleChain(
              candidate.provider_booking_id,
              getCalcomBooking,
            );
          } catch (error) {
            if (!(error instanceof CalcomApiError) || error.status !== 404) throw error;
            return findCalcomBookingLineageByInternalId({
              internalBookingId: candidate.id,
              attendeeEmail: candidate.contact_email,
              createdAt: candidate.provider_last_synced_at ?? candidate.created_at,
              observedAt: observedAtIso,
              sourceUid: candidate.provider_booking_id,
            });
          }
        },
        resolveMissingCreate: async (candidate) => {
          const { data: resolution, error: resolutionError } = await service.rpc(
            'record_missing_provider_create',
            {
              p_booking_id: candidate.id,
              p_checked_at: observedAtIso,
              p_expected_operation_started_at:
                createStartedAtByBooking.get(candidate.id) ?? null,
            },
          );
          if (resolutionError || !resolution || typeof resolution !== 'object') {
            throw new Error('Missing provider create could not be recorded');
          }
          return (resolution as { resolved?: unknown }).resolved === true;
        },
        resolveMutationTerminalEvidence: async (candidate, evidence, snapshot) => {
          const operation = liveOperationByBooking.get(candidate.id);
          if (
            !candidate.provider_booking_id ||
            (
              operation &&
              operation.operation_type !== 'cancel' &&
              operation.operation_type !== 'reschedule'
            ) ||
            (!operation && candidate.lifecycle_status !== 'cancellation_pending')
          ) {
            throw new Error('Terminal evidence anchor is missing');
          }
          const { data: resolution, error: resolutionError } = await service.rpc(
            'record_provider_mutation_terminal_evidence',
            {
              p_booking_id: candidate.id,
              p_expected_provider_booking_id: candidate.provider_booking_id,
              p_evidence_kind: evidence,
              p_checked_at: observedAtIso,
              p_expected_operation_started_at: operation?.started_at ?? null,
              p_staged_resolution_target:
                evidence === 'source_active'
                  ? 'scheduled'
                  : evidence === 'source_pending'
                    ? 'pending_confirmation'
                    : null,
              p_provider_starts_at: snapshot?.startsAt ?? null,
              p_provider_ends_at: snapshot?.endsAt ?? null,
              p_provider_status: snapshot?.status ?? null,
              p_meeting_url: snapshot?.meetingUrl ?? null,
            },
          );
          if (resolutionError || !resolution || typeof resolution !== 'object') {
            throw new Error('Provider mutation evidence could not be recorded');
          }
          return (resolution as { resolved?: unknown }).resolved === true;
        },
        hasLiveMutationOperation: (candidate) => {
          const operation = liveOperationByBooking.get(candidate.id);
          return operation?.operation_type === 'cancel' || operation?.operation_type === 'reschedule';
        },
        applyObservation: async (observation) => {
          const { data: result, error: processingError } = await service.rpc(
            'process_provider_booking_event',
            {
              p_provider: 'calcom',
              p_provider_event_id: observation.providerEventId,
              p_event_type: observation.eventType,
              p_booking_id: observation.bookingId,
              p_provider_booking_id: observation.providerBookingId,
              p_occurred_at: observation.occurredAt,
              p_target_lifecycle: observation.targetLifecycle,
              p_provider_starts_at: observation.providerStartsAt,
              p_provider_ends_at: observation.providerEndsAt,
              p_provider_status: observation.providerStatus,
              p_meeting_url: observation.meetingUrl,
              p_payload: observation.payload,
              p_payload_sha256: observation.payloadSha256,
            },
          );
          if (processingError) throw new Error('Provider event processing failed');
          return providerEventResultSchema.parse(result);
        },
      },
      observedAt,
    );

    const problemCount = counts.unresolved + counts.providerErrors + counts.rpcErrors;
    const systemicFailure = counts.selected > 0 && problemCount === counts.selected;
    return NextResponse.json(
      {
        ok: problemCount === 0 && !rateLimitCleanupError,
        rateLimitCleanup: rateLimitCleanupError ? 'failed' : 'ok',
        batchLimit: RECONCILIATION_BATCH_SIZE,
        batchCapacity: {
          urgent: RECONCILIATION_URGENT_BATCH_SIZE,
          audit: RECONCILIATION_AUDIT_BATCH_SIZE,
        },
        possiblyMore:
          (urgentData?.length ?? 0) === RECONCILIATION_URGENT_BATCH_SIZE ||
          (auditData?.length ?? 0) === RECONCILIATION_AUDIT_BATCH_SIZE,
        ...counts,
      },
      { status: systemicFailure || rateLimitCleanupError ? 503 : 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const response = apiErrorResponse(error);
    response.headers.set('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
    return response;
  }
}
