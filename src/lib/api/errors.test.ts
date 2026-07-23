import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorResponse, parseJsonRequest } from './errors';

describe('apiErrorResponse', () => {
  it('returns only a stable code and never exposes internal error copy', async () => {
    const response = apiErrorResponse(
      new ApiError(409, 'SLOT_UNAVAILABLE', 'Provider detail that must stay server-side.'),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(await response.json()).toEqual({ error: { code: 'SLOT_UNAVAILABLE' } });
  });

  it('uses a generic code for unexpected exceptions', async () => {
    const response = apiErrorResponse(new Error('database connection detail'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: 'INTERNAL_ERROR' } });
  });
});

describe('parseJsonRequest', () => {
  it('enforces the byte limit even without a Content-Length header', async () => {
    const request = new Request('https://msm.test/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(128) }),
    });
    request.headers.delete('content-length');

    await expect(parseJsonRequest(request, { maxBytes: 64 })).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('parses a body that fits within the configured limit', async () => {
    const request = new Request('https://msm.test/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });

    await expect(parseJsonRequest(request, { maxBytes: 64 })).resolves.toEqual({ ok: true });
  });
});
