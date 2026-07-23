import { describe, expect, it } from 'vitest';
import { apiClientError, clientErrorMessage, germanApiErrorMessage } from './client-error';

describe('germanApiErrorMessage', () => {
  it('maps public API codes without exposing server copy', () => {
    expect(
      germanApiErrorMessage(
        { error: { code: 'SLOT_UNAVAILABLE', message: 'That time is unavailable.' } },
        'Fallback',
      ),
    ).toBe('Dieser Termin wurde gerade vergeben. Bitte wähle einen anderen Zeitpunkt.');
  });

  it('uses the local fallback for unknown or malformed provider responses', () => {
    expect(germanApiErrorMessage({ error: { code: 'UNKNOWN', message: 'English detail' } }, 'Fallback')).toBe(
      'Fallback',
    );
    expect(germanApiErrorMessage(null, 'Fallback')).toBe('Fallback');
  });

  it('only exposes errors explicitly marked as safe for the client', () => {
    expect(
      clientErrorMessage(apiClientError({ error: { code: 'NO_CREDITS' } }, 'Fallback'), 'Fallback'),
    ).toBe('Für dieses Paket ist kein Stundenguthaben mehr verfügbar.');
    expect(clientErrorMessage(new TypeError('Failed to fetch'), 'Lokaler Fehlertext')).toBe(
      'Lokaler Fehlertext',
    );
  });
});
