import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { parseCalcomWebhook, verifyCalcomWebhookSignature } from '@/lib/calcom/webhooks';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const lifecycleByTrigger = {
  BOOKING_CREATED: 'scheduled',
  BOOKING_REQUESTED: 'pending_confirmation',
  BOOKING_RESCHEDULED: 'scheduled',
  BOOKING_CANCELLED: 'cancelled',
  BOOKING_REJECTED: 'cancelled',
  MEETING_ENDED: 'completed',
} as const;

function validInstant(value: string | null): string | null {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export async function POST(request: Request) {
  try {
    const receivedAt = new Date();
    const rawBody = await request.text();
    if (!verifyCalcomWebhookSignature(rawBody, request.headers.get('x-cal-signature-256'))) {
      throw new ApiError(400, 'INVALID_SIGNATURE', 'Invalid Cal.com signature.');
    }

    let event;
    try {
      event = parseCalcomWebhook(rawBody, receivedAt);
    } catch {
      throw new ApiError(400, 'INVALID_WEBHOOK', 'Invalid Cal.com webhook payload.');
    }

    const internalBookingId = z.uuid().safeParse(event.internalBookingId);
    const { data, error } = await createSupabaseServiceClient().rpc(
      'process_provider_booking_event',
      {
        p_provider: 'calcom',
        p_provider_event_id: event.eventId,
        p_event_type: event.trigger,
        p_booking_id: internalBookingId.success ? internalBookingId.data : null,
        p_provider_booking_id: event.providerBookingUid,
        p_occurred_at: validInstant(event.occurredAt),
        p_target_lifecycle: lifecycleByTrigger[event.trigger],
        p_provider_starts_at: validInstant(event.startsAt),
        p_provider_ends_at: validInstant(event.endsAt),
        p_provider_status: event.providerStatus,
        p_meeting_url: event.meetingUrl,
        p_payload: event.payload,
        p_payload_sha256: event.payloadSha256,
      },
    );
    if (error) throw new ApiError(503, 'EVENT_PROCESSING_FAILED', 'The provider event could not be processed.');
    const result = z.object({ event_status: z.string() }).passthrough().safeParse(data);
    if (!result.success || result.data.event_status === 'failed') {
      throw new ApiError(503, 'EVENT_PROCESSING_FAILED', 'The provider event could not be processed.');
    }

    return NextResponse.json({ received: true, result: data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
