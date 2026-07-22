import { CalcomApiError } from './server';

// A 400 or 409 can be returned for a stale source UID after another actor has
// already rescheduled the booking. Without a provider result proving no
// mutation, those responses must retain the local target hold for reconciliation.
export function isDeterministicRescheduleFailure(error: unknown): boolean {
  return (
    error instanceof CalcomApiError &&
    error.operation === 'reschedule' &&
    [401, 403, 422].includes(error.status)
  );
}
