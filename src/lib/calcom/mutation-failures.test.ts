import { describe, expect, it } from 'vitest';
import { CalcomApiError } from './server';
import { isDeterministicRescheduleFailure } from './mutation-failures';

describe('reschedule provider failure classification', () => {
  it.each([401, 403, 422])('treats HTTP %i as a deterministic rejection', (status) => {
    expect(isDeterministicRescheduleFailure(new CalcomApiError(status, 'reschedule'))).toBe(true);
  });

  it.each([400, 404, 409, 429, 500, 503])(
    'keeps HTTP %i ambiguous for lineage reconciliation',
    (status) => {
      expect(isDeterministicRescheduleFailure(new CalcomApiError(status, 'reschedule'))).toBe(false);
    },
  );

  it('does not classify another operation or a transport error as deterministic', () => {
    expect(isDeterministicRescheduleFailure(new CalcomApiError(403, 'cancel'))).toBe(false);
    expect(isDeterministicRescheduleFailure(new TypeError('network failed'))).toBe(false);
  });
});
