import { z } from 'zod';
import { isTutorSlug, type TutorSlug } from '@/domain/catalog';
import { assertServerOnly } from '@/lib/security/server-only';
import { ServiceConfigurationError } from '@/lib/supabase/config';

assertServerOnly('Cal.com configuration');

const eventTypeIdSchema = z.coerce.number().int().positive();

const placeholderSecretPatterns = [
  /^(?:your|replace|generate)(?:[\s_-]|$)/i,
  /^(?:change[\s_-]?me|changeme|example|placeholder|todo|secret)$/i,
  /^<[^>]+>$/,
  /^\$\{[^}]+\}$/,
];

export const PRODUCTION_SHARED_SECRET_MIN_BYTES = 32;

export type CalcomEventTypeMapping = Partial<Record<TutorSlug, number>>;

export function parseEventTypeMapping(raw: string | null | undefined): CalcomEventTypeMapping {
  if (!raw?.trim()) return {};

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ServiceConfigurationError('Cal.com tutor event type mapping');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceConfigurationError('Cal.com tutor event type mapping');
  }

  const mapping: CalcomEventTypeMapping = {};
  for (const [slug, eventTypeId] of Object.entries(value)) {
    if (!isTutorSlug(slug)) throw new ServiceConfigurationError('Cal.com tutor event type mapping');
    const parsedId = eventTypeIdSchema.safeParse(eventTypeId);
    if (!parsedId.success) throw new ServiceConfigurationError('Cal.com tutor event type mapping');
    mapping[slug] = parsedId.data;
  }

  return mapping;
}

export function resolveTutorEventTypeId(
  tutorSlug: TutorSlug,
  configuration: {
    mappingJson?: string | null;
    defaultEventTypeId?: string | number | null;
  } = {},
): number {
  const mapping = parseEventTypeMapping(
    configuration.mappingJson === undefined
      ? process.env.CALCOM_EVENT_TYPE_IDS_JSON
      : configuration.mappingJson,
  );

  if (mapping[tutorSlug]) return mapping[tutorSlug]!;

  const fallback = eventTypeIdSchema.safeParse(
    configuration.defaultEventTypeId === undefined
      ? process.env.CALCOM_DEFAULT_EVENT_TYPE_ID
      : configuration.defaultEventTypeId,
  );
  if (fallback.success) return fallback.data;

  throw new ServiceConfigurationError(`Cal.com event type for ${tutorSlug}`);
}

export function requireCalcomApiKey(): string {
  const apiKey = process.env.CALCOM_API_KEY?.trim();
  if (!apiKey) throw new ServiceConfigurationError('Cal.com');
  return apiKey;
}

/**
 * Release gate for callback and scheduler secrets. Development may use a
 * shorter non-placeholder value, while production requires 256 bits of input.
 */
export function isAcceptableSharedSecret(
  value: string | null | undefined,
  production = process.env.NODE_ENV === 'production',
): value is string {
  if (!value || value !== value.trim()) return false;
  if (placeholderSecretPatterns.some((pattern) => pattern.test(value))) return false;
  return !production || new TextEncoder().encode(value).byteLength >= PRODUCTION_SHARED_SECRET_MIN_BYTES;
}

export function requireCalcomWebhookSecret(): string {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!isAcceptableSharedSecret(secret)) throw new ServiceConfigurationError('Cal.com webhook');
  return secret;
}
