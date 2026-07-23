import { describe, expect, it } from 'vitest';
import { safeInternalRedirect } from './safe-redirect';

describe('safeInternalRedirect', () => {
  it('keeps valid same-origin paths, queries and fragments', () => {
    expect(safeInternalRedirect('/booking?package=small#date')).toBe('/booking?package=small#date');
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/%2f%2fevil.example',
    '/\\evil.example',
    '/%5cevil.example',
    '/safe\nSet-Cookie:bad',
    '/safe/%2e%2e/admin',
    'dashboard',
  ])('rejects unsafe redirect %s', (value) => {
    expect(safeInternalRedirect(value)).toBe('/dashboard');
  });

  it('uses a caller-provided fallback for missing input', () => {
    expect(safeInternalRedirect(null, '/login')).toBe('/login');
  });
});
