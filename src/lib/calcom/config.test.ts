import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAcceptableSharedSecret,
  parseEventTypeMapping,
  PRODUCTION_SHARED_SECRET_MIN_BYTES,
  requireCalcomWebhookSecret,
  resolveTutorEventTypeId,
} from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Cal.com event type configuration', () => {
  it('parses a canonical per-tutor mapping', () => {
    expect(parseEventTypeMapping('{"mateo-mamaladze":3976917}')).toEqual({
      'mateo-mamaladze': 3976917,
    });
  });

  it('prefers the tutor mapping over a global fallback', () => {
    expect(resolveTutorEventTypeId('len-sobol', {
      mappingJson: '{"len-sobol":42}',
      defaultEventTypeId: 99,
    })).toBe(42);
  });

  it('uses a validated positive global fallback', () => {
    expect(resolveTutorEventTypeId('johannes-jacob', {
      mappingJson: '{}',
      defaultEventTypeId: '88',
    })).toBe(88);
  });

  it.each([
    '{not-json}',
    '[]',
    '{"unknown-tutor":42}',
    '{"mateo-mamaladze":0}',
  ])('rejects malformed or unknown mappings: %s', (value) => {
    expect(() => parseEventTypeMapping(value)).toThrow();
  });

  it('fails closed when no tutor or default event type is configured', () => {
    expect(() => resolveTutorEventTypeId('juan-rivera-chopinaud', {
      mappingJson: '{}',
      defaultEventTypeId: null,
    })).toThrow();
  });
});

describe('shared callback secret configuration', () => {
  it.each([
    'YOUR_CALCOM_WEBHOOK_SIGNING_SECRET',
    'GENERATE_A_LONG_RANDOM_SECRET',
    'CHANGE_ME',
    'placeholder',
    '<webhook-secret>',
    '${CALCOM_WEBHOOK_SECRET}',
  ])('rejects a known placeholder in every environment: %s', (value) => {
    expect(isAcceptableSharedSecret(value, false)).toBe(false);
    expect(isAcceptableSharedSecret(value, true)).toBe(false);
  });

  it('requires at least 32 UTF-8 bytes in production', () => {
    expect(isAcceptableSharedSecret('x'.repeat(PRODUCTION_SHARED_SECRET_MIN_BYTES - 1), true)).toBe(false);
    expect(isAcceptableSharedSecret('x'.repeat(PRODUCTION_SHARED_SECRET_MIN_BYTES), true)).toBe(true);
    expect(isAcceptableSharedSecret('x'.repeat(16), false)).toBe(true);
  });

  it('rejects leading and trailing whitespace', () => {
    expect(isAcceptableSharedSecret(' xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', true)).toBe(false);
    expect(isAcceptableSharedSecret('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ', true)).toBe(false);
  });

  it('applies the release gate directly when loading the Cal.com webhook secret', () => {
    vi.stubEnv('CALCOM_WEBHOOK_SECRET', ' YOUR_CALCOM_WEBHOOK_SIGNING_SECRET ');
    expect(() => requireCalcomWebhookSecret()).toThrow();

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CALCOM_WEBHOOK_SECRET', 'short-but-random');
    expect(() => requireCalcomWebhookSecret()).toThrow();

    const configuredSecret = 'w'.repeat(PRODUCTION_SHARED_SECRET_MIN_BYTES);
    vi.stubEnv('CALCOM_WEBHOOK_SECRET', configuredSecret);
    expect(requireCalcomWebhookSecret()).toBe(configuredSecret);
  });
});
