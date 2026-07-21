import { assertServerOnly } from '@/lib/security/server-only';
import {
  requireSupabasePublicConfig,
  ServiceConfigurationError,
  type SupabasePublicConfig,
} from './config';

assertServerOnly('Supabase service-role configuration');

interface SupabaseServiceConfig extends SupabasePublicConfig {
  serviceRoleKey: string;
}

export function requireSupabaseServiceConfig(): SupabaseServiceConfig {
  const publicConfig = requireSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new ServiceConfigurationError('Supabase service role');
  return { ...publicConfig, serviceRoleKey };
}
