import { createHmac } from 'node:crypto';
import { ApiError } from '@/lib/api/errors';
import { assertServerOnly } from '@/lib/security/server-only';
import { ServiceConfigurationError } from '@/lib/supabase/config';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

assertServerOnly('API rate limiting');

function rateLimitSecret(): string {
  const configured = process.env.RATE_LIMIT_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return 'msm-local-rate-limit-key-not-for-production';
  }
  throw new ServiceConfigurationError('API rate limiting');
}

function requestIdentity(request: Request, subject?: string): string {
  if (subject) return `subject:${subject}`;
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = process.env.VERCEL === '1'
    ? vercelForwarded || forwarded || 'unknown'
    : request.headers.get('x-real-ip')?.trim() || forwarded || 'unknown';
  return `network:${address}`;
}

export async function enforceRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  subject?: string;
}): Promise<void> {
  const keyHash = createHmac('sha256', rateLimitSecret())
    .update(requestIdentity(input.request, input.subject))
    .digest('hex');
  const { data, error } = await createSupabaseServiceClient().rpc('consume_api_rate_limit', {
    p_scope: input.scope,
    p_key_hash: keyHash,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });
  if (error) throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Request protection is unavailable.');
  if (!data) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
}
