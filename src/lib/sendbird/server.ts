import { z } from 'zod';
import { assertServerOnly } from '@/lib/security/server-only';
import { ServiceConfigurationError } from '@/lib/supabase/config';

assertServerOnly('Sendbird Platform API client');

const sendbirdErrorSchema = z.object({ code: z.number().optional() }).passthrough();
const sendbirdTokenSchema = z.object({ token: z.string().min(1), expires_at: z.number().int() });
const sendbirdChannelSchema = z.object({ channel_url: z.string().min(1) });

interface SendbirdConfig {
  appId: string;
  apiToken: string;
}

export class SendbirdApiError extends Error {
  constructor(readonly status: number) {
    super('Sendbird Platform API request failed');
    this.name = 'SendbirdApiError';
  }
}

function requireSendbirdConfig(): SendbirdConfig {
  const appId = process.env.SENDBIRD_APP_ID?.trim();
  const apiToken = process.env.SENDBIRD_API_TOKEN?.trim();
  if (!appId || !/^[a-zA-Z0-9-]+$/.test(appId) || !apiToken) {
    throw new ServiceConfigurationError('Sendbird');
  }
  return { appId, apiToken };
}

async function sendbirdRequest(path: string, init: RequestInit) {
  const { appId, apiToken } = requireSendbirdConfig();
  const response = await fetch(`https://api-${appId}.sendbird.com/v3${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Api-Token': apiToken,
      'Content-Type': 'application/json; charset=utf-8',
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { appId, response, payload };
}

export function toSendbirdUserId(authUserId: string): string {
  const normalized = authUserId.toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error('Invalid authenticated user ID');
  }
  return `msm_${normalized}`;
}

export async function ensureSendbirdUser(userId: string, nickname: string): Promise<void> {
  const safeNickname = nickname.trim().slice(0, 80) || 'MSM User';
  const create = await sendbirdRequest('/users', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, nickname: safeNickname, profile_url: '' }),
  });
  if (create.response.ok) return;

  const parsedError = sendbirdErrorSchema.safeParse(create.payload);
  if (create.response.status !== 400 || !parsedError.success || parsedError.data.code !== 400202) {
    throw new SendbirdApiError(create.response.status);
  }

  const update = await sendbirdRequest(`/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ nickname: safeNickname }),
  });
  if (!update.response.ok) throw new SendbirdApiError(update.response.status);
}

export async function issueSendbirdSessionToken(userId: string) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1_000;
  const result = await sendbirdRequest(`/users/${encodeURIComponent(userId)}/token`, {
    method: 'POST',
    body: JSON.stringify({ expires_at: expiresAt }),
  });
  if (!result.response.ok) throw new SendbirdApiError(result.response.status);
  const parsed = sendbirdTokenSchema.safeParse(result.payload);
  if (!parsed.success) throw new SendbirdApiError(502);
  return { appId: result.appId, token: parsed.data.token, expiresAt: parsed.data.expires_at };
}

export async function createDistinctParentTutorChannel(input: {
  parentUserId: string;
  tutorUserId: string;
  tutorName: string;
  tutorSlug: string;
}) {
  const result = await sendbirdRequest('/group_channels', {
    method: 'POST',
    body: JSON.stringify({
      user_ids: [input.parentUserId, input.tutorUserId],
      is_distinct: true,
      name: `MSM · ${input.tutorName}`.slice(0, 191),
      custom_type: 'parent_tutor',
      data: JSON.stringify({ tutorSlug: input.tutorSlug }),
    }),
  });
  if (!result.response.ok) throw new SendbirdApiError(result.response.status);
  const parsed = sendbirdChannelSchema.safeParse(result.payload);
  if (!parsed.success) throw new SendbirdApiError(502);
  return parsed.data.channel_url;
}
