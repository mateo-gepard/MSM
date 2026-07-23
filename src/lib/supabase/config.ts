export class ServiceConfigurationError extends Error {
  readonly code = 'SERVICE_NOT_CONFIGURED';

  constructor(service: string) {
    super(`${service} is not configured`);
    this.name = 'ServiceConfigurationError';
  }
}

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/** Returns null when public configuration is absent or malformed. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  // Direct property access is required for Next.js to inline NEXT_PUBLIC values
  // into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;

  if (!url || !anonKey || !isValidSupabaseUrl(url)) return null;
  return { url, anonKey };
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();
  if (!config) throw new ServiceConfigurationError('Supabase');
  return config;
}
