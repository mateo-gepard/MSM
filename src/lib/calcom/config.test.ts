import { describe, expect, it } from 'vitest';
import { parseEventTypeMapping, resolveTutorEventTypeId } from './config';

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
