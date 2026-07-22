import { describe, expect, it } from 'vitest';
import { checkoutSessionSchema } from './commerce-schemas';

describe('checkoutSessionSchema', () => {
  it('accepts a paid package and a stable request UUID', () => {
    expect(checkoutSessionSchema.parse({
      packageId: 'small',
      idempotencyKey: '3d6f0a89-748d-4f23-b21e-8809628abade',
    })).toEqual({
      packageId: 'small',
      idempotencyKey: '3d6f0a89-748d-4f23-b21e-8809628abade',
    });
  });

  it('rejects free trials, unknown fields, and unstable keys', () => {
    expect(checkoutSessionSchema.safeParse({ packageId: 'trial', idempotencyKey: crypto.randomUUID() }).success).toBe(false);
    expect(checkoutSessionSchema.safeParse({ packageId: 'small', idempotencyKey: 'retry-me' }).success).toBe(false);
    expect(checkoutSessionSchema.safeParse({
      packageId: 'small',
      idempotencyKey: crypto.randomUUID(),
      priceCents: 1,
    }).success).toBe(false);
  });
});
