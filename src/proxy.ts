import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { getSupabasePublicConfig } from '@/lib/supabase/config';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabasePublicConfig();

  // Keeping builds and public pages available without configuration is safe;
  // every protected server operation independently authenticates and fails closed.
  if (!config) return response;

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // `getUser` validates and refreshes the session; do not use `getSession` as an auth gate.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
