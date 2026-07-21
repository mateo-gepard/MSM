'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireSupabasePublicConfig } from './config';

let browserClient: SupabaseClient<Database> | undefined;

/** Lazily creates the one browser auth client recommended by `@supabase/ssr`. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { url, anonKey } = requireSupabasePublicConfig();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}
