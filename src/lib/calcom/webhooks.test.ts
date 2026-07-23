import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseCalcomWebhook, verifyCalcomWebhookSignature } from './webhooks';

const rawBody = JSON.stringify({
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2030-05-05T10:00:00.000Z',
  payload: {
    uid: 'cal-booking-123',
    startTime: '2030-05-06T10:00:00.000Z',
    endTime: '2030-05-06T11:00:00.000Z',
    status: 'ACCEPTED',
    metadata: {
      internalBookingId: '3d6f0a89-748d-4f23-b21e-8809628abade',
      videoCallUrl: 'https://cal.video/example',
    },
  },
});

describe('Cal.com webhooks', () => {
  it('uses a constant-time compatible HMAC-SHA256 comparison', () => {
    const signature = createHmac('sha256', 'secret').update(rawBody).digest('hex');
    expect(verifyCalcomWebhookSignature(rawBody, signature, 'secret')).toBe(true);
    expect(verifyCalcomWebhookSignature(rawBody, `sha256=${signature}`, 'secret')).toBe(true);
    expect(verifyCalcomWebhookSignature(rawBody, '0'.repeat(64), 'secret')).toBe(false);
    expect(verifyCalcomWebhookSignature(rawBody, null, 'secret')).toBe(false);
  });

  it('normalizes nested booking events without trusting their metadata for authorization', () => {
    expect(parseCalcomWebhook(rawBody)).toMatchObject({
      trigger: 'BOOKING_CREATED',
      providerBookingUid: 'cal-booking-123',
      internalBookingId: '3d6f0a89-748d-4f23-b21e-8809628abade',
      startsAt: '2030-05-06T10:00:00.000Z',
      endsAt: '2030-05-06T11:00:00.000Z',
      providerStatus: 'ACCEPTED',
      meetingUrl: 'https://cal.video/example',
    });
  });

  it('normalizes the flat meeting-ended payload', () => {
    const flat = JSON.stringify({
      triggerEvent: 'MEETING_ENDED',
      uid: 'cal-booking-456',
      startTime: '2030-05-06T10:00:00.000Z',
      endTime: '2030-05-06T11:00:00.000Z',
      // Cal.com documents this as the booking creation time in the flat
      // MEETING_ENDED payload, which can be days before delivery.
      createdAt: '2030-05-01T09:00:00.000Z',
      metadata: {},
    });
    expect(parseCalcomWebhook(flat, new Date('2030-05-06T11:01:00.000Z'))).toMatchObject({
      trigger: 'MEETING_ENDED',
      providerBookingUid: 'cal-booking-456',
      endsAt: '2030-05-06T11:00:00.000Z',
      occurredAt: '2030-05-06T11:00:00.000Z',
    });
  });

  it('retains provider UID lineage for a replacement booking', () => {
    const rescheduled = JSON.stringify({
      triggerEvent: 'BOOKING_RESCHEDULED',
      createdAt: '2030-05-05T10:00:00.000Z',
      payload: {
        uid: 'replacement-uid',
        rescheduleUid: 'source-uid',
        startTime: '2030-05-07T10:00:00.000Z',
        endTime: '2030-05-07T11:00:00.000Z',
        status: 'ACCEPTED',
      },
    });

    expect(parseCalcomWebhook(rescheduled)).toMatchObject({
      providerBookingUid: 'replacement-uid',
      rescheduledFromUid: 'source-uid',
      rescheduledToUid: null,
    });
  });

  it('derives a stable event identifier when Cal.com omits createdAt', () => {
    const withoutCreatedAt = JSON.stringify({
      triggerEvent: 'BOOKING_CANCELLED',
      payload: { uid: 'cal-booking-789', status: 'CANCELLED' },
    });

    const first = parseCalcomWebhook(withoutCreatedAt);
    const second = parseCalcomWebhook(withoutCreatedAt);
    expect(second.eventId).toBe(first.eventId);
    expect(second.payloadSha256).toBe(first.payloadSha256);
  });

  it('clamps a provider occurrence far in the future to the receipt time', () => {
    const futureDated = JSON.stringify({
      triggerEvent: 'BOOKING_CANCELLED',
      createdAt: '2099-01-01T00:00:00.000Z',
      payload: { uid: 'cal-booking-future', status: 'CANCELLED' },
    });
    const receivedAt = new Date('2030-05-05T10:00:00.000Z');

    expect(parseCalcomWebhook(futureDated, receivedAt).occurredAt).toBe(
      receivedAt.toISOString(),
    );
  });

  it('keeps a provider occurrence inside the allowed clock-skew window', () => {
    const nearFuture = JSON.stringify({
      triggerEvent: 'BOOKING_CREATED',
      createdAt: '2030-05-05T10:04:00.000Z',
      payload: { uid: 'cal-booking-near-future', status: 'ACCEPTED' },
    });

    expect(
      parseCalcomWebhook(nearFuture, new Date('2030-05-05T10:00:00.000Z')).occurredAt,
    ).toBe('2030-05-05T10:04:00.000Z');
  });
});
