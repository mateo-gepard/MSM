import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { assertServerOnly } from '@/lib/security/server-only';
import { requireSupabasePublicConfig } from './config';
import { requireSupabaseServiceConfig } from './server-config';

assertServerOnly('Supabase server client');

/** Creates a cookie-bound client for the current Next.js request. */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = requireSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. `src/proxy.ts` performs refreshes.
        }
      },
    },
  });
}

/**
 * Creates a new privileged client for one server operation. Never import this
 * module into a Client Component and never expose the service-role key.
 */
export function createSupabaseServiceClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = requireSupabaseServiceConfig();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
