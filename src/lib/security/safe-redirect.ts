const DEFAULT_REDIRECT = '/dashboard';

/**
 * Accepts only same-origin path redirects. Protocol-relative URLs, control
 * characters, backslashes and encoded traversal are rejected.
 */
export function safeInternalRedirect(
  candidate: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  if (candidate.includes('\\') || /[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith('//') || decoded.includes('\\') || /[\u0000-\u001f\u007f]/.test(decoded)) {
      return fallback;
    }
    const decodedPath = decoded.split(/[?#]/, 1)[0];
    if (decodedPath.split('/').some((segment) => segment === '.' || segment === '..')) return fallback;

    const parsed = new URL(candidate, 'https://internal.invalid');
    if (parsed.origin !== 'https://internal.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
