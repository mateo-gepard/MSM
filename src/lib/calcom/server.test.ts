import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findCalcomBookingLineageByInternalId } from './server';

const internalBookingId = '8bb08d6d-4bc1-4e5f-9ad8-673f78769341';

function booking(
  uid: string,
  lineage: { from?: string; to?: string } = {},
) {
  return {
    uid,
    start: '2030-05-06T09:00:00.000Z',
    end: '2030-05-06T10:00:00.000Z',
    duration: 60,
    status: 'accepted',
    createdAt: '2030-05-05T08:30:00.000Z',
    metadata: { internalBookingId },
    rescheduledFromUid: lineage.from,
    rescheduledToUid: lineage.to,
  };
}

function listResponse(data: ReturnType<typeof booking>[], hasMore = false, nextCursor: string | null = null) {
  return new Response(JSON.stringify({
    status: 'success',
    data,
    pagination: { hasMore, nextCursor },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function resolveLineage() {
  return findCalcomBookingLineageByInternalId({
    internalBookingId,
    attendeeEmail: 'parent@example.com',
    createdAt: '2030-05-05T08:00:00.000Z',
    observedAt: '2030-05-05T12:00:00.000Z',
    sourceUid: 'source-a',
  });
}

describe('Cal.com 404 lineage recovery', () => {
  beforeEach(() => {
    process.env.CALCOM_API_KEY = 'cal_test_key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CALCOM_API_KEY;
  });

  it('recovers a direct replacement when the source UID is absent from the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => listResponse([
      booking('replacement-b', { from: 'source-a' }),
    ])));

    await expect(resolveLineage()).resolves.toMatchObject({
      uid: 'replacement-b',
      lineageRootUid: 'source-a',
      lineageFirstReplacementUid: 'replacement-b',
    });
  });

  it('accepts prior ancestors only when they form one chain through the current source', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => listResponse([
      booking('ancestor-z', { to: 'source-a' }),
      booking('source-a', { from: 'ancestor-z', to: 'replacement-b' }),
      booking('replacement-b', { from: 'source-a' }),
    ])));

    await expect(resolveLineage()).resolves.toMatchObject({
      uid: 'replacement-b',
      lineageRootUid: 'source-a',
    });
  });

  it('fails closed for an unrelated duplicate internal ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => listResponse([
      booking('replacement-b', { from: 'source-a' }),
      booking('unrelated-x'),
    ])));

    await expect(resolveLineage()).rejects.toMatchObject({
      status: 502,
      operation: 'list',
    });
  });
});
